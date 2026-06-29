import { Injectable, OnModuleInit, InternalServerErrorException, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import KcAdminClient from '@keycloak/keycloak-admin-client';
import { prisma } from '@amdox/db';
import { CreateTenantDto } from './dto/create-tenant.dto';

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
      this.logger.log('✅ Keycloak Admin Client Authenticated');
    } catch (error) {
      this.logger.warn(`⚠️ Failed to authenticate Keycloak Admin Client (Skipping for now): ${(error as Error).message}`);
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

      // Set Password in Keycloak
      await this.kcAdminClient.users.resetPassword({
        realm: slug,
        id: kcUser.id,
        credential: { temporary: false, type: 'password', value: adminPassword },
      });

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
              // We'll leave ssoSubject null or map it to kcUser.id if needed
            },
          },
          // Create default roles for this tenant
          roles: {
            create: [
              { name: 'Tenant Admin', systemRole: 'TENANT_ADMIN' },
              { name: 'Manager', systemRole: 'MANAGER' },
              { name: 'Viewer', systemRole: 'VIEWER' }
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

  async getTenantConfig(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantId } });
    if (!tenant) return { error: 'Tenant not found' };
    return tenant;
  }

  async updateTenantConfig(tenantId: string, updateData: any) {
    return prisma.tenant.update({
      where: { slug: tenantId },
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
    await this.verifyRealmExists(tenantId);
    try {
      const realm = await this.kcAdminClient.realms.findOne({ realm: tenantId });
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
      this.logger.error(`Failed to fetch full Keycloak config for ${tenantId}:`, (error as Error).message);
      return { error: 'Failed to communicate with Identity Provider' };
    }
  }

  async updateKeycloakConfig(tenantId: string, data: any) {
    await this.verifyRealmExists(tenantId);
    try {
      const payload: any = {};
      if (data.login) Object.assign(payload, data.login);
      if (data.smtpServer) payload.smtpServer = data.smtpServer;
      if (data.sessions) Object.assign(payload, data.sessions);
      if (data.tokens) {
        Object.assign(payload, data.tokens);
        delete payload.clientLoginTimeout;
      }

      await this.kcAdminClient.realms.update({ realm: tenantId }, payload);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update Keycloak config for ${tenantId}:`, (error as Error).message);
      return { error: 'Failed to update Identity Provider configuration' };
    }
  }

  async getRequiredActions(tenantId: string) {
    await this.verifyRealmExists(tenantId);
    try {
      return await this.kcAdminClient.authenticationManagement.getRequiredActions({ realm: tenantId } as any);
    } catch (error) {
      this.logger.error(`Failed to fetch required actions for ${tenantId}:`, (error as Error).message);
      return [];
    }
  }

  async updateRequiredAction(tenantId: string, alias: string, data: any) {
    await this.verifyRealmExists(tenantId);
    try {
      await this.kcAdminClient.authenticationManagement.updateRequiredAction(
        { realm: tenantId, alias },
        data
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to update required action ${alias} for ${tenantId}:`, (error as Error).message);
      return { error: 'Failed to update required action' };
    }
  }

  async getIdentityProviders(tenantId: string) {
    await this.verifyRealmExists(tenantId);
    try {
      return await this.kcAdminClient.identityProviders.find({ realm: tenantId });
    } catch (error) {
      this.logger.error(`Failed to fetch identity providers for ${tenantId}:`, (error as Error).message);
      return [];
    }
  }

  async createIdentityProvider(tenantId: string, provider: any) {
    await this.verifyRealmExists(tenantId);
    try {
      await this.kcAdminClient.identityProviders.create({ realm: tenantId }, provider);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to create identity provider for ${tenantId}:`, (error as Error).message);
      return { error: 'Failed to create identity provider' };
    }
  }

  async deleteIdentityProvider(tenantId: string, alias: string) {
    await this.verifyRealmExists(tenantId);
    try {
      await this.kcAdminClient.identityProviders.del({ realm: tenantId, alias });
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to delete identity provider ${alias} for ${tenantId}:`, (error as Error).message);
      return { error: 'Failed to delete identity provider' };
    }
  }

  async getAuthenticationFlows(tenantId: string) {
    await this.verifyRealmExists(tenantId);
    try {
      return await this.kcAdminClient.authenticationManagement.getFlows({ realm: tenantId });
    } catch (error) {
      this.logger.error(`Failed to fetch auth flows for ${tenantId}:`, (error as Error).message);
      return [];
    }
  }

}
 
