import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument = require('pdfkit');
import { BiService } from './bi.service';
import { EmailChannel } from '../notification/channels/email.channel';

@Injectable()
export class BiReportService {
  private readonly logger = new Logger(BiReportService.name);
  private prisma = new PrismaClient();
  private readonly storageRoot = path.join(process.cwd(), 'storage', 'reports');

  constructor(
    private readonly biService: BiService,
    private readonly emailChannel: EmailChannel,
  ) {
    fs.mkdirSync(this.storageRoot, { recursive: true });
  }

  listReports(tenantId: string) {
    return this.prisma.scheduledReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { dashboard: { select: { id: true, name: true } } },
    });
  }

  async createReport(
    tenantId: string,
    data: {
      name: string;
      cronExpr: string;
      format: string;
      recipients: string[];
      dashboardId?: string;
    },
  ) {
    if (data.dashboardId) {
      await this.biService.getDashboard(tenantId, data.dashboardId);
    }
    return this.prisma.scheduledReport.create({
      data: {
        tenantId,
        name: data.name,
        cronExpr: data.cronExpr,
        format: data.format,
        recipients: data.recipients,
        dashboardId: data.dashboardId,
        isActive: true,
      },
    });
  }

  async deleteReport(tenantId: string, id: string) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id, tenantId },
    });
    if (!report) throw new NotFoundException('Scheduled report not found');
    if (report.lastReportPath && fs.existsSync(report.lastReportPath)) {
      fs.unlinkSync(report.lastReportPath);
    }
    return this.prisma.scheduledReport.delete({ where: { id } });
  }

  async runReport(tenantId: string, reportId: string) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id: reportId, tenantId, isActive: true },
    });
    if (!report) throw new NotFoundException('Scheduled report not found');

    const kpis = await this.biService.getExecutiveKpis(tenantId);
    const tenantDir = path.join(this.storageRoot, tenantId);
    fs.mkdirSync(tenantDir, { recursive: true });

    const ext = report.format === 'EXCEL' ? 'csv' : 'pdf';
    const filePath = path.join(tenantDir, `${report.id}.${ext}`);

    if (report.format === 'EXCEL') {
      const csv = this.buildCsv(kpis);
      fs.writeFileSync(filePath, csv, 'utf8');
    } else {
      const pdf = await this.buildPdf(report.name, kpis);
      fs.writeFileSync(filePath, pdf);
    }

    await this.prisma.scheduledReport.update({
      where: { id: report.id },
      data: { lastRunAt: new Date(), lastReportPath: filePath },
    });

    for (const recipient of report.recipients) {
      await this.emailChannel.send({
        to: recipient,
        subject: `[Amdox BI] ${report.name}`,
        body: `Your scheduled ${report.format} report "${report.name}" is ready.`,
        attachmentPath: filePath,
      });
    }

    this.logger.log(`Generated report ${report.name} → ${filePath}`);
    return { reportId: report.id, path: filePath, format: report.format };
  }

  async getReportFile(tenantId: string, reportId: string) {
    const report = await this.prisma.scheduledReport.findFirst({
      where: { id: reportId, tenantId },
    });
    if (!report?.lastReportPath || !fs.existsSync(report.lastReportPath)) {
      throw new NotFoundException('Report file not found. Run the report first.');
    }
    return {
      path: report.lastReportPath,
      format: report.format,
      name: report.name,
    };
  }

  shouldRunNow(cronExpr: string, date = new Date()): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    const dom = date.getDate();
    switch (cronExpr.toLowerCase()) {
      case 'hourly':
        return date.getMinutes() === 0;
      case 'daily':
        return hour === 8 && date.getMinutes() === 0;
      case 'weekly':
        return day === 1 && hour === 8 && date.getMinutes() === 0;
      case 'monthly':
        return dom === 1 && hour === 8 && date.getMinutes() === 0;
      default:
        return hour === 8 && date.getMinutes() === 0;
    }
  }

  private buildCsv(kpis: Awaited<ReturnType<BiService['getExecutiveKpis']>>) {
    const lines = [
      'Metric,Value',
      `Open POs,${kpis.totals.openPurchaseOrders}`,
      `Active Employees,${kpis.totals.activeEmployees}`,
      `Active Projects,${kpis.totals.activeProjects}`,
      `Invoices,${kpis.totals.invoices}`,
      `AR Current,${kpis.arAging.current}`,
      `AR 31-60,${kpis.arAging.d31_60}`,
      `AR 61-90,${kpis.arAging.d61_90}`,
      `AR 90+,${kpis.arAging.over90}`,
      '',
      'SKU,Product,Quantity',
      ...kpis.inventorySnapshot.map(
        (s) => `${s.sku},"${s.name}",${s.quantity}`,
      ),
    ];
    return lines.join('\n');
  }

  private buildPdf(
    title: string,
    kpis: Awaited<ReturnType<BiService['getExecutiveKpis']>>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];
        doc.on('data', (b) => buffers.push(b));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        doc.fontSize(18).text('Amdox ERP — BI Report', { align: 'center' });
        doc.moveDown().fontSize(14).text(title, { align: 'center' });
        doc.moveDown();
        doc.fontSize(11).text(`Generated: ${new Date().toISOString()}`);
        doc.moveDown();
        doc.text(`Open POs: ${kpis.totals.openPurchaseOrders}`);
        doc.text(`Active Employees: ${kpis.totals.activeEmployees}`);
        doc.text(`Active Projects: ${kpis.totals.activeProjects}`);
        doc.text(`Invoices: ${kpis.totals.invoices}`);
        doc.moveDown().text('AR Aging');
        doc.text(`  Current: ₹${kpis.arAging.current.toLocaleString()}`);
        doc.text(`  31–60: ₹${kpis.arAging.d31_60.toLocaleString()}`);
        doc.text(`  61–90: ₹${kpis.arAging.d61_90.toLocaleString()}`);
        doc.text(`  90+: ₹${kpis.arAging.over90.toLocaleString()}`);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
