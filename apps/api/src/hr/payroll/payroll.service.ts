/**
 * SERVICE: payroll.service.ts
 * 
 * Business logic for HR payroll. Handles payroll runs, payslip generation and
 * employee payroll aggregation.
 */
import { Injectable, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaClient, PayrollRunStatus, EmploymentStatus } from '@amdox/db';

interface PayrollRow {
  employeeId: string;
  employeeName: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  payslipUrl: string | null;
}

@Injectable()
export class PayrollService {
  private prisma = new PrismaClient();

  async enqueuePayrollRun(tenantId: string, payPeriod: string) {
    const period = this.normalizePayPeriod(payPeriod);

    const payrollRun = await this.prisma.payrollRun.create({
      data: {
        tenantId,
        periodLabel: period.label,
        status: PayrollRunStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    void this.processPayrollRun(payrollRun.id, tenantId, period.start, period.end, period.label);

    return {
      payrollRunId: payrollRun.id,
      status: 'processing',
    };
  }

  async findPayrollByPeriod(tenantId: string, payPeriod: string) {
    const period = this.normalizePayPeriod(payPeriod);

    const payslips = await this.prisma.payslip.findMany({
      where: {
        tenantId,
        payrollRun: {
          periodLabel: period.label,
        },
      },
      include: {
        employee: true,
        payrollRun: true,
      },
    });

    return payslips.map((payslip) => ({
      id: payslip.id,
      employeeId: payslip.employeeId,
      employeeName: payslip.employee.fullName,
      payPeriod: payslip.payrollRun.periodLabel,
      grossPay: Number(payslip.grossPay),
      deductions: Number(payslip.deductions),
      netPay: Number(payslip.netPay),
      status: payslip.pdfUrl ? 'Processed' : 'Pending',
      payslipUrl: payslip.pdfUrl,
    }));
  }

  async getPayrollRun(tenantId: string, payrollRunId: string) {
    const payrollRun = await this.prisma.payrollRun.findFirst({
      where: { id: payrollRunId, tenantId },
      include: { payslips: true },
    });

    if (!payrollRun) {
      throw new NotFoundException('Payroll run not found');
    }

    return {
      id: payrollRun.id,
      periodLabel: payrollRun.periodLabel,
      status: payrollRun.status,
      totalNetPay: payrollRun.totalNetPay ? Number(payrollRun.totalNetPay) : 0,
      startedAt: payrollRun.startedAt,
      completedAt: payrollRun.completedAt,
      payslipCount: payrollRun.payslips.length,
    };
  }

  async getPayslipsForRun(tenantId: string, payrollRunId: string) {
    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, payrollRunId },
      include: { employee: true },
    });

    return payslips.map((payslip) => ({
      id: payslip.id,
      employeeId: payslip.employeeId,
      employeeName: payslip.employee.fullName,
      grossPay: Number(payslip.grossPay),
      deductions: Number(payslip.deductions),
      netPay: Number(payslip.netPay),
      payslipUrl: payslip.pdfUrl,
      status: payslip.pdfUrl ? 'Processed' : 'Pending',
    }));
  }

  async getPayslipPdf(tenantId: string, payslipId: string) {
    const payslip = await this.prisma.payslip.findFirst({
      where: { id: payslipId, tenantId },
      include: { employee: true, payrollRun: true },
    });

    if (!payslip) {
      throw new NotFoundException('Payslip not found');
    }

    return this.createPdfBuffer(payslip.employee.fullName, payslip.payrollRun.periodLabel, {
      grossPay: Number(payslip.grossPay),
      deductions: Number(payslip.deductions),
      netPay: Number(payslip.netPay),
    });
  }

  private async processPayrollRun(payrollRunId: string, tenantId: string, start: Date, end: Date, label: string) {
    try {
      const employees = await this.prisma.employee.findMany({
        where: {
          tenantId,
          status: EmploymentStatus.ACTIVE,
        },
        include: {
          contracts: {
            where: {
              startDate: { lte: end },
              OR: [
                { endDate: null },
                { endDate: { gte: start } },
              ],
            },
            orderBy: { startDate: 'desc' },
          },
        },
      });

      const employeeIds = employees.map((employee) => employee.id);
      const attendanceRecords = await this.prisma.attendanceRecord.findMany({
        where: {
          tenantId,
          employeeId: { in: employeeIds },
          clockIn: { gte: start, lt: end },
          clockOut: { not: null },
        },
      });

      const payslipRows = employees
        .map((employee) => {
          const contract = employee.contracts[0];
          if (!contract) {
            return null;
          }

          const relevantRecords = attendanceRecords.filter((record) => record.employeeId === employee.id);
          const overtimeMins = relevantRecords.reduce((sum, record) => sum + record.overtimeMins, 0);
          const overtimeHours = overtimeMins / 60;

          const salary = Number(contract.salary);
          const monthlyHours = 160;
          const hourlyRate = salary / monthlyHours;
          const overtimePay = overtimeHours * hourlyRate * 1.5;
          const grossPay = Number((salary + overtimePay).toFixed(4));
          const deductions = Number((grossPay * 0.12).toFixed(4));
          const netPay = Number((grossPay - deductions).toFixed(4));

          return {
            employeeId: employee.id,
            employeeName: employee.fullName,
            grossPay,
            deductions,
            netPay,
            payslipUrl: `/hr/payroll/${employee.id}/payslip`,
          };
        })
        .filter((row): row is PayrollRow => row !== null);

      const createdPayslips = await this.prisma.$transaction(
        payslipRows.map((row) =>
          this.prisma.payslip.create({
            data: {
              tenantId,
              payrollRunId,
              employeeId: row.employeeId,
              grossPay: row.grossPay,
              deductions: row.deductions,
              netPay: row.netPay,
              pdfUrl: row.payslipUrl,
            },
          }),
        ),
      );

      const totalNetPay = createdPayslips.reduce((sum, payslip) => sum + Number(payslip.netPay), 0);

      await this.prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          totalNetPay: totalNetPay.toFixed(4),
          status: PayrollRunStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: PayrollRunStatus.FAILED,
          completedAt: new Date(),
        },
      });
      console.error('Payroll run failed:', error);
    }
  }

  private normalizePayPeriod(payPeriod: string) {
    if (!payPeriod || typeof payPeriod !== 'string') {
      throw new BadRequestException('payPeriod is required');
    }

    const trimmed = payPeriod.trim();
    let parsedDate: Date;

    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      parsedDate = new Date(`${trimmed}-01T00:00:00Z`);
    } else {
      parsedDate = new Date(trimmed);
      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date(`${trimmed} 1`);
      }
    }

    if (isNaN(parsedDate.getTime())) {
      throw new BadRequestException('Invalid pay period format. Use YYYY-MM or a month/year label.');
    }

    const year = parsedDate.getUTCFullYear();
    const month = parsedDate.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));
    const label = parsedDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });

    return { start, end, label };
  }

  private createPdfBuffer(employeeName: string, payPeriod: string, amounts: { grossPay: number; deductions: number; netPay: number }) {
    const lines = [
      `Amdox ERP Payslip`,
      `Employee: ${employeeName}`,
      `Pay Period: ${payPeriod}`,
      `Gross Pay: ₹${amounts.grossPay.toFixed(2)}`,
      `Deductions: ₹${amounts.deductions.toFixed(2)}`,
      `Net Pay: ₹${amounts.netPay.toFixed(2)}`,
    ];

    const escape = (text: string) => text.replace(/([\\()])/g, '\\$1');
    const contentLines = lines
      .map((line, index) => `40 ${760 - index * 20} Td (${escape(line)}) Tj`)
      .join('\n');
    const contentStream = `BT /F1 12 Tf\n${contentLines}\nET\n`;

    const objects = [
      '%PDF-1.1\n',
      `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
      `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, 'utf8')} >>\nstream\n${contentStream}endstream\nendobj\n`,
      `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`,
    ];

    let offset = 0;
    const xrefEntries: string[] = ['0000000000 65535 f \n'];
    const bodyParts: Buffer[] = [];

    for (const object of objects) {
      const buffer = Buffer.from(object, 'utf8');
      bodyParts.push(buffer);
      xrefEntries.push(offset.toString().padStart(10, '0') + ' 00000 n \n');
      offset += buffer.length;
    }

    const body = Buffer.concat(bodyParts);
    const xrefStart = body.length;
    const xrefHeader = Buffer.from(`xref\n0 ${objects.length + 1}\n${xrefEntries.join('')}`, 'utf8');
    const trailer = Buffer.from(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, 'utf8');

    return Buffer.concat([body, xrefHeader, trailer]);
  }
}
