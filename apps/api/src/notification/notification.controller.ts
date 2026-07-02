import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List in-app notifications for tenant' })
  list(@Req() req: any) {
    const tenantId =
      req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.notificationService.listForTenant(tenantId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markRead(@Req() req: any, @Param('id') id: string) {
    const tenantId =
      req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
    return this.notificationService.markRead(tenantId, id);
  }
}
