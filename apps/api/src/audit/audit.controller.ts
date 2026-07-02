import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(AuthGuard('keycloak'))
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Immutable audit trail for tenant' })
  getLogs(@Req() req: any) {
    const tenantId =
      req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.auditService.getLogs(tenantId);
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify tamper-evident hash chain integrity' })
  verifyChain(@Req() req: any) {
    const tenantId =
      req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.auditService.verifyIntegrity(tenantId);
  }
}
