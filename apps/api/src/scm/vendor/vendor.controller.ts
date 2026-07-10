import { Controller, Get, Post, Body, Patch, Param, Delete, Req, UseGuards } from '@nestjs/common';
import { VendorService } from './vendor.service';
import { VendorPortalService } from '../vendor-portal/vendor-portal.service';
import { CreateVendorDto } from '../dto/create-vendor.dto';
import { UpdateVendorDto } from '../dto/update-vendor.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Vendors')
@ApiBearerAuth()
@RequireModule('scm')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('scm/vendors')
export class VendorController {
  constructor(
    private readonly vendorService: VendorService,
    private readonly vendorPortalService: VendorPortalService,
  ) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  create(@Req() req: any, @Body() createVendorDto: CreateVendorDto) {
    return this.vendorService.create(req.user.tenantId, createVendorDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  findAll(@Req() req: any) {
    return this.vendorService.findAll(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.vendorService.findOne(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() updateVendorDto: UpdateVendorDto) {
    return this.vendorService.update(req.user.tenantId, id, updateVendorDto);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Post(':id/portal-key')
  issuePortalKey(@Req() req: any, @Param('id') id: string) {
    return this.vendorPortalService.issuePortalKey(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.vendorService.remove(req.user.tenantId, id);
  }
}
