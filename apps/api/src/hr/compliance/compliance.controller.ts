import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ComplianceService } from './compliance.service';

@ApiTags('HR - Statutory Compliance')
@ApiBearerAuth()
@RequireModule('hr')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('hr/compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Get('statutory')
  @ApiOperation({ summary: 'Get statutory compliance configuration (PF, ESI, PT, gratuity)' })
  getStatutory(@Req() req: any) {
    return this.complianceService.getStatutoryCompliance(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Patch('statutory')
  @ApiOperation({ summary: 'Update statutory compliance rates' })
  updateStatutory(@Req() req: any, @Body() body: Record<string, unknown>) {
    return this.complianceService.updateStatutoryCompliance(req.user.tenantId, body);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Get('tax-slabs')
  @ApiOperation({ summary: 'List income tax slabs' })
  listTaxSlabs(@Req() req: any) {
    return this.complianceService.listTaxSlabs(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Post('tax-slabs')
  @ApiOperation({ summary: 'Create an income tax slab' })
  createTaxSlab(
    @Req() req: any,
    @Body() body: { name: string; minSalary: number; maxSalary?: number; rate: number },
  ) {
    return this.complianceService.createTaxSlab(req.user.tenantId, body);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Delete('tax-slabs/:id')
  @ApiOperation({ summary: 'Remove an income tax slab' })
  removeTaxSlab(@Req() req: any, @Param('id') id: string) {
    return this.complianceService.removeTaxSlab(req.user.tenantId, id);
  }
}
