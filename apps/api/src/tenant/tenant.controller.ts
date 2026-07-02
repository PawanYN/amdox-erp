import { Controller, Get, Put, Post, Delete, Body, Req, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Tenant Configuration')
@ApiBearerAuth()
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) { }

  @Get('exists/:slug')
  @ApiOperation({ summary: 'Check if a tenant with the given slug exists' })
  async tenantExists(@Param('slug') slug: string) {
    return this.tenantService.tenantExists(slug);
  }

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
  async updateRequiredAction(@Req() req: any, @Param('alias') alias: string, @Body() updateData: any) {
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
}
