import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@amdox/db';
import { BiReportService } from './bi-report.service';

@Injectable()
export class BiReportScheduler {
  private readonly logger = new Logger(BiReportScheduler.name);
  private prisma = new PrismaClient();

  constructor(private readonly reportService: BiReportService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledReports() {
    const reports = await this.prisma.scheduledReport.findMany({
      where: { isActive: true },
    });

    for (const report of reports) {
      if (!this.reportService.shouldRunNow(report.cronExpr)) continue;
      try {
        await this.reportService.runReport(report.tenantId, report.id);
        this.logger.log(`Scheduled report "${report.name}" executed`);
      } catch (err) {
        this.logger.error(`Failed scheduled report ${report.id}`, err);
      }
    }
  }
}
