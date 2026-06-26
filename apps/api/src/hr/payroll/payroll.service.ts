/**
 * ============================================================================
 * SERVICE: payroll.service.ts
 * ============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This service controls the HR Payroll lifecycle. It manages initiating 
 * payroll runs for a specific month and fetching historical payslips.
 * 
 * HOW IT IS IMPLEMENTED (NOW WITH BULLMQ!):
 * - `enqueuePayrollRun`: When an HR admin triggers a payroll run, this 
 *   function no longer does the heavy lifting itself! Instead, it creates a 
 *   `PayrollRun` record in the database with status `PROCESSING`, and pushes 
 *   a fast, reliable message into the `payroll` Redis queue via BullMQ. 
 * - The actual heavy calculation (gross-to-net, PDF generation) is handled 
 *   asynchronously by our background worker (`payroll.processor.ts`).
 * - This ensures the API immediately returns HTTP 202 to the frontend, 
 *   keeping the UI snappy even if we are processing 10,000 employees.
 * 
 * RELEVANT CONTEXT FOR NEW DEVS:
 * BullMQ uses Redis to guarantee that jobs are not lost if the Node.js server 
 * crashes. If a crash happens mid-payroll, BullMQ will simply retry the job!
 * ============================================================================
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PayrollRunStatus } from '@amdox/db';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PayslipGenerator } from './payslip-generator';

@Injectable()
export class PayrollService {
  private prisma = new PrismaClient();

  constructor(
    @InjectQueue('payroll') private payrollQueue: Queue,
    private payslipGenerator: PayslipGenerator
  ) {}

  async enqueuePayrollRun(tenantId: string, payPeriod: string) {
    const period = this.normalizePayPeriod(payPeriod);

    // Create the tracker record
    const payrollRun = await this.prisma.payrollRun.create({
      data: {
        tenantId,
        periodLabel: period.label,
        status: PayrollRunStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    // Enqueue the background job to BullMQ
    await this.payrollQueue.add('run', {
      payrollRunId: payrollRun.id,
      tenantId,
      start: period.start,
      end: period.end,
      label: period.label,
    });

    return {
      payrollRunId: payrollRun.id,
      status: 'processing',
      message: 'Payroll run queued successfully in the background.'
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

    // Return the dynamically generated PDF buffer using proper pdfkit
    return this.payslipGenerator.generatePdfBuffer(
      payslip.employee.fullName,
      payslip.payrollRun.periodLabel,
      {
        grossPay: Number(payslip.grossPay),
        deductions: Number(payslip.deductions),
        netPay: Number(payslip.netPay),
      }
    );
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
}

