import { Controller, Get, Put, Post, Delete, Body, Req, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tenant Configuration')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Get('exists/:slug')
  @ApiOperation({ summary: 'Check if a tenant with the given slug exists' })
  async tenantExists(@Param('slug') slug: string) {
    return this.tenantService.tenantExists(slug);
  }

  // Unauthenticated by design (this is how a brand-new tenant signs up), so it's the
  // single most rate-limit-sensitive route in the API — a tighter cap than the global
  // default, since each call provisions a real Keycloak realm.
  @Throttle({ short: { limit: 2, ttl: 10000 }, medium: { limit: 5, ttl: 60000 } })
  @Post()
  @ApiOperation({ summary: 'Create a new Tenant (Provisions Keycloak Realm + Prisma DB)' })
  async createTenant(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.createTenant(createTenantDto);
  }

  @Get('config')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async getTenantConfig(@Req() req: any) {
    // Extracted by our middleware or guard
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getTenantConfig(tenantId);
  }

  @Put('config')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async updateTenantConfig(@Req() req: any, @Body() updateData: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.updateTenantConfig(tenantId, updateData);
  }

  @Get('keycloak-config')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async getKeycloakConfig(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getKeycloakConfig(tenantId);
  }

  @Put('keycloak-config')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async updateKeycloakConfig(@Req() req: any, @Body() updateData: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.updateKeycloakConfig(tenantId, updateData);
  }

  @Get('required-actions')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async getRequiredActions(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getRequiredActions(tenantId);
  }

  @Put('required-actions/:alias')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async updateRequiredAction(
    @Req() req: any,
    @Param('alias') alias: string,
    @Body() updateData: any,
  ) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.updateRequiredAction(tenantId, alias, updateData);
  }

  @Get('identity-providers')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async getIdentityProviders(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getIdentityProviders(tenantId);
  }

  @Post('identity-providers')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async createIdentityProvider(@Req() req: any, @Body() provider: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.createIdentityProvider(tenantId, provider);
  }

  @Delete('identity-providers/:alias')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async deleteIdentityProvider(@Req() req: any, @Param('alias') alias: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.deleteIdentityProvider(tenantId, alias);
  }

  @Get('authentication-flows')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async getAuthenticationFlows(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getAuthenticationFlows(tenantId);
  }

  @Get('mfa')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async getMfaEnforcement(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getMfaEnforcement(tenantId);
  }

  /**
   * PUT /tenant/mfa  { enforced: boolean }
   * Per-tenant MFA enforcement (F-01). Enabling flags every user without an
   * authenticator to set one up at next login and prompts for OTP on both
   * password and SSO/social logins. Disabling stops requiring setup; users
   * who already have an authenticator keep using it.
   */
  @Put('mfa')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async setMfaEnforcement(@Req() req: any, @Body() body: { enforced: boolean }) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.setMfaEnforcement(tenantId, body?.enforced === true);
  }

  /**
   * POST /tenant/provision-kc-roles
   * One-time idempotent migration: creates Keycloak realm roles and assigns them
   * to existing tenant admin users so JWT realm_access.roles is populated.
   * Call this once for any tenant created before this fix was deployed.
   */
  @Post('provision-kc-roles')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async provisionKcRoles(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.provisionKcRoles(tenantId);
  }

  /**
   * POST /tenant/provision-auto-link
   * One-time idempotent migration: creates the "auto-link" first-broker-login
   * flow and switches existing identity providers to it (with trustEmail), so
   * SSO/social logins for already-provisioned emails link instead of blocking.
   * Call this once for any tenant whose IdPs were added before this fix.
   */
  @Post('provision-auto-link')
  @UseGuards(AuthGuard('keycloak'), RolesGuard)
  @Roles('SuperAdmin', 'TenantAdmin')
  async provisionAutoLink(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.provisionAutoLink(tenantId);
  }
}
