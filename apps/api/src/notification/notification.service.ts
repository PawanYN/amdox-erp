import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient, NotificationChannel, NotificationDeliveryStatus } from '@amdox/db';

export interface NotifyInput {
  tenantId: string;
  eventType: string;
  title: string;
  body?: string;
  userId?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationEngine');
  private prisma = new PrismaClient();

  async notify(input: NotifyInput) {
    const notification = await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
      },
    });

    await this.dispatchTerminal(notification.id, input);

    return notification;
  }

  private async dispatchTerminal(notificationId: string, input: NotifyInput) {
    const payload = {
      channel: 'TERMINAL',
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      tenantId: input.tenantId,
      userId: input.userId,
      at: new Date().toISOString(),
    };

    this.logger.log(`[NOTIFICATION] ${JSON.stringify(payload)}`);

    await this.prisma.notificationDelivery.create({
      data: {
        tenantId: input.tenantId,
        notificationId,
        channel: NotificationChannel.IN_APP,
        status: NotificationDeliveryStatus.SENT,
        attempts: 1,
        sentAt: new Date(),
      },
    });
  }

  async listForTenant(tenantId: string, limit = 50) {
    return this.prisma.notification.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { deliveries: true },
    });
  }

  async markRead(tenantId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, tenantId },
      data: { isRead: true },
    });
  }
}
