import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@amdox/db';

@Injectable()
export class MilestoneOverdueScheduler {
  private readonly logger = new Logger(MilestoneOverdueScheduler.name);
  private prisma = new PrismaClient();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /** Daily scan for milestones that became overdue in the last 24 hours. */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scanOverdueMilestones() {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // tenant-scope-ok: system-wide daily cron scan across every tenant's milestones
    // by design — each milestone's own tenantId is threaded through the emitted event.
    const milestones = await this.prisma.milestone.findMany({
      where: {
        isAchieved: false,
        dueDate: { lt: now, gte: since },
      },
      include: { project: { select: { name: true } } },
    });

    for (const m of milestones) {
      this.eventEmitter.emit('milestone.overdue', {
        tenantId: m.tenantId,
        projectId: m.projectId,
        milestoneId: m.id,
        name: m.name,
        dueDate: m.dueDate,
      });
    }

    if (milestones.length > 0) {
      this.logger.log(`Emitted ${milestones.length} milestone.overdue alert(s)`);
    }
  }
}
