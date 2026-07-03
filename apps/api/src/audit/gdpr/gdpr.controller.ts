import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DataSubjectRequestType } from '@amdox/db';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { GdprService } from './gdpr.service';
import { AuditService } from '../audit.service';

@ApiTags('GDPR')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('gdpr')
export class GdprController {
  constructor(
    private readonly gdprService: GdprService,
    private readonly auditService: AuditService,
  ) {}

  private tenantId(req: any): string {
    return req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Get('requests')
  @ApiOperation({ summary: 'List GDPR data subject requests' })
  listRequests(@Req() req: any) {
    return this.gdprService.listRequests(this.tenantId(req));
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Post('requests')
  @ApiOperation({ summary: 'Create a data subject request (access, erasure, portability)' })
  async createRequest(
    @Req() req: any,
    @Body('subjectEmail') subjectEmail: string,
    @Body('type') type: DataSubjectRequestType,
  ) {
    const tenantId = this.tenantId(req);
    const dsr = await this.gdprService.createRequest(tenantId, subjectEmail, type);
    await this.auditService.record({
      tenantId,
      userId: req.user?.sub,
      action: 'DSR_CREATED',
      entityType: 'DataSubjectRequest',
      entityId: dsr.id,
      afterState: { subjectEmail, type },
    });
    return dsr;
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Patch('requests/:id/fulfill')
  @ApiOperation({ summary: 'Mark a DSR as fulfilled (target < 72h per PDF)' })
  async fulfill(@Req() req: any, @Param('id') id: string) {
    const tenantId = this.tenantId(req);
    const dsr = await this.gdprService.fulfillRequest(tenantId, id);
    await this.auditService.record({
      tenantId,
      userId: req.user?.sub,
      action: 'DSR_FULFILLED',
      entityType: 'DataSubjectRequest',
      entityId: id,
    });
    return dsr;
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Post('consent')
  recordConsent(
    @Req() req: any,
    @Body('subjectEmail') subjectEmail: string,
    @Body('consentType') consentType: string,
    @Body('granted') granted: boolean,
  ) {
    return this.gdprService.recordConsent(
      this.tenantId(req),
      subjectEmail,
      consentType,
      granted,
    );
  }

  @Roles('SuperAdmin', 'TenantAdmin')
  @Get('consent')
  listConsent(@Req() req: any, @Query('subjectEmail') subjectEmail?: string) {
    return this.gdprService.listConsents(this.tenantId(req), subjectEmail);
  }
}
