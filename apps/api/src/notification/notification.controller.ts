import { Body, Controller, Get, Patch, Param, Req, Sse, UseGuards } from '@nestjs/common';
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

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for tenant' })
  list(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.notificationService.listForTenant(tenantId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.notificationService.markRead(tenantId, id);
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

  @Get('preferences')
  @ApiOperation({ summary: "List the current user's per-channel notification preferences" })
  listPreferences(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.notificationService.listPreferences(tenantId, req.user.id ?? req.user.sub);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Enable or disable a channel for an event type' })
  setPreference(@Req() req: any, @Body() dto: SetPreferenceDto) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.notificationService.setPreference(
      tenantId,
      req.user.id ?? req.user.sub,
      dto.eventType,
      dto.channel,
      dto.isEnabled,
    );
  }
}
