/**
 * CONTROLLER: audit.controller.ts
 * 
 * This file acts as the "Traffic Cop". It receives incoming HTTP requests (like GET or POST)
 * from the frontend, reads the URL, and forwards the work to the correct Service file.
 * DO NOT put heavy database logic here!
 */
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(AuthGuard('keycloak'))
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  @Get('logs')
  getLogs(@Req() req: any) {
    const tenantId = req.tenantId || 'default-tenant-id';
    return this.auditService.getDummyAuditLogs(tenantId);
  }
}
