import { Injectable, OnModuleInit, InternalServerErrorException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { prisma } from '@amdox/db';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { AmdoxLogger } from '../common/logger/amdox-logger';

@Injectable()
export class TenantService implements OnModuleInit {
  private kcAdminClient: KcAdminClient;
  private readonly logger = new Logger(TenantService.name);

  async tenantExists(slug: string): Promise<{ exists: boolean }> {
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    return { exists: !!tenant };
  }

  async onModuleInit() {
    this.kcAdminClient = new KcAdminClient({
      baseUrl: process.env.KEYCLOAK_BASE_URL || 'http://localhost:8180',
      realmName: 'master', 
    });

    try {
      const authPromise = this.kcAdminClient.auth({
        username: process.env.KEYCLOAK_ADMIN_USERNAME || 'admin',
        password: process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin',
        grantType: 'password',
        clientId: 'admin-cli',
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Keycloak connection timed out after 3s')), 3000)
      );

      await Promise.race([authPromise, timeoutPromise]);
      AmdoxLogger.tenant('Keycloak Admin Client authenticated');
    } catch (error) {
      AmdoxLogger.warn('Keycloak Admin Client auth failed — continuing without KC', (error as Error).message);
    }
  }

  async createTenant(dto: CreateTenantDto) {
    const { name, slug, adminEmail, adminPassword } = dto;

    // 1. Check if slug already exists in DB
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      throw new ConflictException('Tenant slug is already taken.');
    }

    // 2. KEYCLOAK ORCHESTRATION (Layer 1 Isolation)
    let kcUserId: string | undefined;
    try {
      // Create Realm
      await this.kcAdminClient.realms.create({
        realm: slug,
        enabled: true,
        displayName: name,
      });

      // Create Frontend Client in new Realm
      await this.kcAdminClient.clients.create({
        realm: slug,
        clientId: 'amdox-erp-web',
        enabled: true,
        publicClient: true,
        secret: 'amdox-secret-123', // In prod, generate a secure UUID
        standardFlowEnabled: true,
        directAccessGrantsEnabled: true,
        redirectUris: ['http://localhost:3000/*', 'http://localhost:3001/*'],
        webOrigins: ['+'],
      });

      // Create Admin User in Keycloak
      const kcUser = await this.kcAdminClient.users.create({
        realm: slug,
        username: adminEmail,
        email: adminEmail,
        enabled: true,
        emailVerified: true,
      });
      kcUserId = kcUser.id;

      // Set Password in Keycloak
      await this.kcAdminClient.users.resetPassword({
        realm: slug,
        id: kcUser.id,
        credential: { temporary: false, type: 'password', value: adminPassword },
      });

      // Create realm roles so they appear in JWT realm_access.roles
      for (const roleName of ['TenantAdmin', 'Manager', 'Viewer', 'Employee']) {
        await this.kcAdminClient.roles.create({ realm: slug, name: roleName });
      }

      // Assign TenantAdmin realm role to the provisioned admin user
      const kcAdminRole = await this.kcAdminClient.roles.findOneByName({ realm: slug, name: 'TenantAdmin' });
      if (kcAdminRole?.id) {
        await this.kcAdminClient.users.addRealmRoleMappings({
          realm: slug,
          id: kcUser.id,
          roles: [{ id: kcAdminRole.id, name: kcAdminRole.name! }],
        });
      }

    } catch (error) {
      this.logger.error('Keycloak provisioning failed:', error);
      throw new InternalServerErrorException('Failed to provision Identity Provider for Tenant');
    }

    // 3. PRISMA DB ORCHESTRATION
    try {
      // We must run this OUTSIDE the tenant filter since the tenant doesn't exist yet.
      // Fortunately, creating a new Tenant does not trigger the where clause filter.
      const newTenant = await prisma.tenant.create({
        data: {
          name,
          slug,
          plan: 'STANDARD',
          // Create the admin user instantly via nested write
          users: {
            create: {
              email: adminEmail,
              fullName: 'Tenant Admin',
              ssoSubject: kcUserId,
            },
          },
          // Create default roles for this tenant
          roles: {
            create: [
              { name: 'TenantAdmin', systemRole: 'TENANT_ADMIN' },
              { name: 'Manager', systemRole: 'MANAGER' },
              { name: 'Viewer', systemRole: 'VIEWER' },
              { name: 'Employee', systemRole: 'EMPLOYEE' }
            ]
          },
          leaveTypes: {
            create: [
              { name: 'Annual Leave', accrualRate: 1.16 },
              { name: 'Sick Leave', accrualRate: 0.5 }
            ]
          }
        },
        include: {
          users: true,
          roles: true,
        }
      });

      // Assign the TENANT_ADMIN role to the newly created user
      const adminRole = newTenant.roles.find(r => r.systemRole === 'TENANT_ADMIN');
      const adminUser = newTenant.users[0];

      // Logs with Orange ANSI Color (\x1b[38;5;208m)
      this.logger.log(`Tenant created: \x1b[38;5;208m${newTenant.name}\x1b[0m`);
      if (adminUser) {
        this.logger.log(`User created: \x1b[38;5;208m${adminUser.fullName} (${adminUser.email})\x1b[0m`);
      }

      if (adminRole && adminUser) {
        await prisma.userRole.create({
          data: {
            tenantId: newTenant.id,
            userId: adminUser.id,
            roleId: adminRole.id,
          }
        });
      }

      return newTenant;

    } catch (error) {
      this.logger.error('Database provisioning failed:', error);
      throw new InternalServerErrorException('Failed to provision database for Tenant');
    }
  }

  async provisionEmployeeUser(tenantId: string, email: string, fullName: string) {
    const tenant = await this.getTenant(tenantId);
    
    // Generate a temporary password
    const tempPassword = 'Amdox' + Math.floor(1000 + Math.random() * 9000) + '!';

    let kcUserId: string | undefined;
    try {
      // 1. Create User in Keycloak
      const kcUser = await this.kcAdminClient.users.create({
        realm: tenant.slug,
        username: email,
        email: email,
        firstName: fullName.split(' ')[0] || '',
        lastName: fullName.split(' ').slice(1).join(' ') || '',
        enabled: true,
        emailVerified: true,
      });
      kcUserId = kcUser.id;

      // 2. Set temporary password
      await this.kcAdminClient.users.resetPassword({
        realm: tenant.slug,
        id: kcUser.id,
        credential: { temporary: true, type: 'password', value: tempPassword },
      });

      console.log(`\x1b[33m[KEYCLOAK USER PROVISIONED] Created KC User: ${kcUserId} for ${email}\x1b[0m`);

      // 3. Log password in BOLD DARK PINK (ANSI: \x1b[1;38;5;198m ... \x1b[0m)
      this.logger.log(`\x1b[1;38;5;198m[NEW EMPLOYEE LOGIN] Email: ${email} | Temporary Password: ${tempPassword}\x1b[0m`);
    } catch (error) {
      this.logger.error('Failed to provision Keycloak user for employee:', error);
      throw new InternalServerErrorException('Failed to create Keycloak user');
    }

    // 4. Create User in Prisma
    try {
      // Find the Employee role ID for this tenant
      const employeeRole = await prisma.role.findFirst({
        where: { tenantId: tenant.id, systemRole: 'EMPLOYEE' }
      });

      const newUser = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email,
          fullName,
          ssoSubject: kcUserId,
        }
      });
      console.log(`\x1b[34m[PRISMA USER PROVISIONED] Created Prisma User: ${newUser.id} for ${email}\x1b[0m`);

      if (employeeRole) {
        await prisma.userRole.create({
          data: {
            tenantId: tenant.id,
            userId: newUser.id,
            roleId: employeeRole.id,
          }
        });
        console.log(`\x1b[38;2;99;102;241m[PRISMA USER ROLE] Assigned Role ${employeeRole.name} to User ${newUser.id}\x1b[0m`);
      }

      return newUser.id;
    } catch (error: any) {
      if (kcUserId) {
        console.log(`\x1b[31m[ROLLBACK] Prisma creation failed. Deleting Keycloak User: ${kcUserId}\x1b[0m`);
        try {
          await this.kcAdminClient.users.del({ realm: tenant.slug, id: kcUserId });
        } catch (kcErr) {
          console.error(`\x1b[31m[CRITICAL] Failed to rollback Keycloak user: ${kcUserId}\x1b[0m`);
        }
      }
      this.logger.error('Failed to provision Prisma user for employee: ' + (error.message || error));
      if (error.stack) this.logger.error(error.stack);
      throw new InternalServerErrorException('Failed to create Prisma user');
    }
  }

  async getTenant(idOrSlug: string) {
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug }
        ]
      }
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant not found for id/slug: ${idOrSlug}`);
    }
    return tenant;
  }

  async getTenantConfig(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    return tenant;
  }

  async updateTenantConfig(tenantId: string, updateData: any) {
    const tenant = await this.getTenant(tenantId);
    return prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: updateData.name,
        // other updatable fields...
      },
    });
  }

  async verifyRealmExists(realm: string) {
    try {
      const exists = await this.kcAdminClient.realms.findOne({ realm });
      if (!exists) {
        throw new NotFoundException(`Keycloak Realm '${realm}' does not exist.`);
      }
    } catch (err) {
      throw new NotFoundException(`Keycloak Realm '${realm}' does not exist or is unreachable.`);
    }
  }

  async getKeycloakConfig(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      const realm = await this.kcAdminClient.realms.findOne({ realm: tenant.slug });
      if (!realm) return { error: 'Keycloak Realm not found for this tenant' };

      return {
        login: {
          registrationAllowed: realm.registrationAllowed ?? false,
          resetPasswordAllowed: realm.resetPasswordAllowed ?? false,
          rememberMe: realm.rememberMe ?? false,
          registrationEmailAsUsername: realm.registrationEmailAsUsername ?? false,
          loginWithEmailAllowed: realm.loginWithEmailAllowed ?? true,
          duplicateEmailsAllowed: realm.duplicateEmailsAllowed ?? false,
          verifyEmail: realm.verifyEmail ?? false,
          editUsernameAllowed: realm.editUsernameAllowed ?? false,
        },
        smtpServer: realm.smtpServer || {},
        sessions: {
          ssoSessionIdleTimeout: realm.ssoSessionIdleTimeout ?? 1800,
          ssoSessionMaxLifespan: realm.ssoSessionMaxLifespan ?? 36000,
          ssoSessionIdleTimeoutRememberMe: realm.ssoSessionIdleTimeoutRememberMe ?? 0,
          ssoSessionMaxLifespanRememberMe: realm.ssoSessionMaxLifespanRememberMe ?? 0,
          clientSessionIdleTimeout: realm.clientSessionIdleTimeout ?? 0,
          clientSessionMaxLifespan: realm.clientSessionMaxLifespan ?? 0,
          offlineSessionIdleTimeout: realm.offlineSessionIdleTimeout ?? 2592000,
          offlineSessionMaxLifespanEnabled: realm.offlineSessionMaxLifespanEnabled ?? false,
          accessCodeLifespanUserAction: realm.accessCodeLifespanUserAction ?? 300,
          accessCodeLifespan: realm.accessCodeLifespan ?? 1800,
        },
        tokens: {
          defaultSignatureAlgorithm: realm.defaultSignatureAlgorithm || 'RS256',
          oauth2DeviceCodeLifespan: realm.oauth2DeviceCodeLifespan ?? 600,
          oauth2DevicePollingInterval: realm.oauth2DevicePollingInterval ?? 5,
          revokeRefreshToken: realm.revokeRefreshToken ?? false,
          accessTokenLifespan: realm.accessTokenLifespan ?? 300,
          accessTokenLifespanForImplicitFlow: realm.accessTokenLifespanForImplicitFlow ?? 900,
          clientLoginTimeout: (realm as any).clientLoginTimeout ?? 60,
          actionTokenGeneratedByUserLifespan: realm.actionTokenGeneratedByUserLifespan ?? 300,
          actionTokenGeneratedByAdminLifespan: realm.actionTokenGeneratedByAdminLifespan ?? 43200,
        }
      };
    } catch (error) {
      this.logger.error(`Failed to fetch full Keycloak config for ${tenant.slug}:`, (error as Error).message);
      return { error: 'Failed to communicate with Identity Provider' };
    }
  }

  async updateKeycloakConfig(tenantId: string, data: any) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      const payload: any = {};
      if (data.login) Object.assign(payload, data.login);
      if (data.smtpServer) payload.smtpServer = data.smtpServer;
      if (data.sessions) Object.assign(payload, data.sessions);
      if (data.tokens) {
        Object.assign(payload, data.tokens);
        delete payload.clientLoginTimeout;
      }

      await this.kcAdminClient.realms.update({ realm: tenant.slug }, payload);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update Keycloak config for ${tenant.slug}:`, (error as Error).message);
      return { error: 'Failed to update Identity Provider configuration' };
    }
  }

  async getRequiredActions(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      return await this.kcAdminClient.authenticationManagement.getRequiredActions({ realm: tenant.slug } as any);
    } catch (error) {
      this.logger.error(`Failed to fetch required actions for ${tenant.slug}:`, (error as Error).message);
      return [];
    }
  }

  async updateRequiredAction(tenantId: string, alias: string, data: any) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      await this.kcAdminClient.authenticationManagement.updateRequiredAction(
        { realm: tenant.slug, alias },
        data
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update required action ${alias} for ${tenant.slug}:`, (error as Error).message);
      return { error: 'Failed to update required action' };
    }
  }

  async getIdentityProviders(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      return await this.kcAdminClient.identityProviders.find({ realm: tenant.slug });
    } catch (error) {
      this.logger.error(`Failed to fetch identity providers for ${tenant.slug}:`, (error as Error).message);
      return [];
    }
  }

  async createIdentityProvider(tenantId: string, provider: any) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      await this.kcAdminClient.identityProviders.create({ realm: tenant.slug }, provider);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to create identity provider for ${tenant.slug}:`, (error as Error).message);
      return { error: 'Failed to create identity provider' };
    }
  }

  async deleteIdentityProvider(tenantId: string, alias: string) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      await this.kcAdminClient.identityProviders.del({ realm: tenant.slug, alias });
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to delete identity provider ${alias} for ${tenant.slug}:`, (error as Error).message);
      return { error: 'Failed to delete identity provider' };
    }
  }

  async getAuthenticationFlows(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);
    try {
      return await this.kcAdminClient.authenticationManagement.getFlows({ realm: tenant.slug });
    } catch (error) {
      this.logger.error(`Failed to fetch auth flows for ${tenant.slug}:`, (error as Error).message);
      return [];
    }
  }

  /**
   * One-time migration: ensure Keycloak realm roles exist and are assigned to the
   * tenant admin user. Safe to call on existing tenants (idempotent).
   */
  async provisionKcRoles(tenantId: string) {
    const tenant = await this.getTenant(tenantId);
    await this.verifyRealmExists(tenant.slug);

    // 1. Ensure realm roles exist in Keycloak
    for (const roleName of ['TenantAdmin', 'Manager', 'Viewer', 'Employee']) {
      try {
        await this.kcAdminClient.roles.create({ realm: tenant.slug, name: roleName });
      } catch {
        // Role already exists — ignore
      }
    }

    // 2. Normalize DB role name to match Keycloak (strip spaces)
    await prisma.role.updateMany({
      where: { tenantId: tenant.id, systemRole: 'TENANT_ADMIN' },
      data: { name: 'TenantAdmin' },
    });

    // 3. Find all users in this tenant who have TENANT_ADMIN in DB and assign them the realm role
    const adminUsers = await prisma.userRole.findMany({
      where: {
        tenantId: tenant.id,
        role: { systemRole: 'TENANT_ADMIN' },
      },
      include: { user: true },
    });

    const kcAdminRole = await this.kcAdminClient.roles.findOneByName({ realm: tenant.slug, name: 'TenantAdmin' });
    if (!kcAdminRole?.id) return { success: false, error: 'TenantAdmin realm role not found after creation' };

    for (const ur of adminUsers) {
      if (!ur.user.ssoSubject) continue;
      try {
        await this.kcAdminClient.users.addRealmRoleMappings({
          realm: tenant.slug,
          id: ur.user.ssoSubject,
          roles: [{ id: kcAdminRole.id, name: kcAdminRole.name! }],
        });
      } catch {
        // Already assigned — ignore
      }
    }

    this.logger.log(`✅ Keycloak realm roles provisioned for tenant: ${tenant.slug}`);
    return { success: true, tenant: tenant.slug, admins: adminUsers.map(u => u.user.email) };
  }

}
 
