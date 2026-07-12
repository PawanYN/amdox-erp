import { Body, Controller, Delete, Get, Patch, Param, Req, Sse, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { NotificationService } from './notification.service';
import { SetPreferenceDto } from './dto/set-preference.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private isTenantAdmin(req: {
    user?: { roles?: string[]; userRoles?: { role: { name: string } }[] };
  }) {
    const fromRoles = req.user?.roles ?? [];
    const fromDb = (req.user?.userRoles ?? []).map((ur) => ur.role.name.replace(/\s+/g, ''));
    const roles = [...fromRoles, ...fromDb];
    return roles.includes('TenantAdmin') || roles.includes('SuperAdmin');
  }

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for the current user' })
  list(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    const userId = req.user?.id ?? req.user?.sub;
    return this.notificationService.listForTenant(tenantId, userId, this.isTenantAdmin(req));
  }

  @Get('preferences')
  @ApiOperation({ summary: "List the current user's per-channel notification preferences" })
  listPreferences(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    const userId = req.user?.id ?? req.user?.sub;
    return this.notificationService.listPreferences(tenantId, userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Enable or disable a channel for an event type' })
  setPreference(@Req() req: any, @Body() dto: SetPreferenceDto) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    const userId = req.user?.id ?? req.user?.sub;
    return this.notificationService.setPreference(
      tenantId,
      userId,
      dto.eventType,
      dto.channel,
      dto.isEnabled,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    const userId = req.user?.id ?? req.user?.sub;
    return this.notificationService.markRead(tenantId, id, userId, this.isTenantAdmin(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  remove(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    const userId = req.user?.id ?? req.user?.sub;
    return this.notificationService.deleteNotification(
      tenantId,
      id,
      userId,
      this.isTenantAdmin(req),
    );
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Real-time in-app notification push over Server-Sent Events' })
  stream(@Req() req: any): Observable<MessageEvent> {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    const userId = req.user?.id ?? req.user?.sub;
    return this.notificationService.getStream().pipe(
      filter((evt) => evt.tenantId === tenantId && (!evt.userId || evt.userId === userId)),
      map((evt) => ({ data: evt.notification }) as MessageEvent),
    );
  }
}
