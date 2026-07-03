import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(AuthGuard('keycloak'), RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Roles('SuperAdmin', 'TenantAdmin')
  @Get('logs')
  @ApiOperation({ summary: 'Immutable audit trail for tenant' })
  getLogs(@Req() req: any) {
    const tenantId =
      req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.auditService.getLogs(tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Get('verify')
  @ApiOperation({ summary: 'Verify tamper-evident hash chain integrity' })
  verifyChain(@Req() req: any) {
    const tenantId =
      req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.auditService.verifyIntegrity(tenantId);
  }
}
