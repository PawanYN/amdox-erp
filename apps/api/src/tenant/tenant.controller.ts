import { Controller, Get, Put, Post, Delete, Body, Req, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@ApiTags('Tenant Configuration')
// @ApiBearerAuth()
// @UseGuards(AuthGuard('keycloak'))
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
  async getTenantConfig(@Req() req: any) {
    // Extracted by our middleware or guard
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getTenantConfig(tenantId);
  }

  @Put('config')
  async updateTenantConfig(@Req() req: any, @Body() updateData: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.updateTenantConfig(tenantId, updateData);
  }



  @Get('keycloak-config')
  async getKeycloakConfig(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getKeycloakConfig(tenantId);
  }

  @Put('keycloak-config')
  async updateKeycloakConfig(@Req() req: any, @Body() updateData: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.updateKeycloakConfig(tenantId, updateData);
  }

  @Get('required-actions')
  async getRequiredActions(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getRequiredActions(tenantId);
  }

  @Put('required-actions/:alias')
  async updateRequiredAction(@Req() req: any, @Param('alias') alias: string, @Body() updateData: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.updateRequiredAction(tenantId, alias, updateData);
  }

  @Get('identity-providers')
  async getIdentityProviders(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getIdentityProviders(tenantId);
  }

  @Post('identity-providers')
  async createIdentityProvider(@Req() req: any, @Body() provider: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.createIdentityProvider(tenantId, provider);
  }

  @Delete('identity-providers/:alias')
  async deleteIdentityProvider(@Req() req: any, @Param('alias') alias: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.deleteIdentityProvider(tenantId, alias);
  }

  @Get('authentication-flows')
  async getAuthenticationFlows(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getAuthenticationFlows(tenantId);
  }
}
