import { Controller, Get, Put, Post, Body, Req, Param, UseGuards } from '@nestjs/common';
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

  @Get('sso')
  async getSsoConfig(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.getSsoConfig(tenantId);
  }

  @Put('sso')
  async updateSsoConfig(@Req() req: any, @Body() updateData: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.tenantService.updateSsoConfig(tenantId, updateData);
  }
}
