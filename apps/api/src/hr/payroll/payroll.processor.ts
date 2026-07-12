/**
 * ============================================================================
 * BACKGROUND WORKER: payroll.processor.ts
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This worker picks up jobs dispatched by `payroll.service.ts` and processes
 * them asynchronously using BullMQ (Redis).
 *
 * HOW IT IS IMPLEMENTED (10k SCALE):
 * - It fetches employees in chunks (e.g., 500 at a time) using Prisma `take` and `skip`.
 * - For each employee, it applies statutory deductions (PF, ESI, PT, LWF) from the
 *   tenant's Statutory Compliance config, plus income tax (TDS) from tax slabs.
 * - It calls `PayslipGenerator` (pdfkit) to generate the PDF buffer.
 * - This prevents the Node server from crashing out of memory when processing
 *   large enterprise workforces.
 * ============================================================================
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { prisma, EmploymentStatus } from '@amdox/db';
import { Logger } from '@nestjs/common';
import { AmdoxLogger } from '../../common/logger/amdox-logger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayslipGenerator } from './payslip-generator';
import { StorageService } from '../../common/storage/storage.service';
import { ComplianceService } from '../compliance/compliance.service';
import { calculatePayrollAmounts, resolveTaxSlabRate } from './payroll-deductions';

@Processor('payroll')
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);
  constructor(
    private readonly payslipGenerator: PayslipGenerator,
    private readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly complianceService: ComplianceService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { payrollRunId, tenantId, start, end, label } = job.data;
    AmdoxLogger.hr(`Payroll run started: ${label}`, `runId=${payrollRunId}  tenant=${tenantId}`);

    try {
      // Compensation step (TDD runbook: "revert partial calculations"): a BullMQ
      // retry re-enters this handler from employee 0, so any payslips written by
      // a previous failed attempt must be removed first or they would duplicate
      // and inflate totalNetPay.
      const stale = await prisma.payslip.deleteMany({ where: { payrollRunId, tenantId } });
      if (stale.count > 0) {
        AmdoxLogger.warn(
          `Removed ${stale.count} payslip(s) from a previous failed attempt`,
          `runId=${payrollRunId}`,
        );
      }

      const [taxSlabs, statutory] = await Promise.all([
        prisma.taxSlab.findMany({
          where: { tenantId },
          orderBy: { minSalary: 'asc' },
        }),
        this.complianceService.getStatutoryCompliance(tenantId),
      ]);

      const CHUNK_SIZE = 500;
      let skip = 0;
      let totalProcessed = 0;
      let totalNetPaySum = 0;

      while (true) {
        // Fetch chunk of employees
        const employees = await prisma.employee.findMany({
          where: { tenantId, status: EmploymentStatus.ACTIVE },
          include: {
            contracts: {
              where: {
                startDate: { lte: new Date(end) },
                OR: [{ endDate: null }, { endDate: { gte: new Date(start) } }],
              },
              orderBy: { startDate: 'desc' },
            },
          },
          take: CHUNK_SIZE,
          skip,
        });

        if (employees.length === 0) break;

        const employeeIds = employees.map((e) => e.id);
        const attendanceRecords = await prisma.attendanceRecord.findMany({
          where: {
            tenantId,
            employeeId: { in: employeeIds },
            clockIn: { gte: new Date(start), lt: new Date(end) },
            clockOut: { not: null },
          },
        });

        const payslipInserts = [];

        for (const employee of employees) {
          const contract = employee.contracts[0];
          if (!contract) continue;

          // Compute overtimes
          const relevantRecords = attendanceRecords.filter(
            (record) => record.employeeId === employee.id,
          );
          const overtimeMins = relevantRecords.reduce(
            (sum, record) => sum + record.overtimeMins,
            0,
          );
          const overtimeHours = overtimeMins / 60;

          const salary = Number(contract.salary);
          const monthlyHours = 160;
          const hourlyRate = salary / monthlyHours;
          const overtimePay = overtimeHours * hourlyRate * 1.5;

          const taxSlabRate = resolveTaxSlabRate(salary, taxSlabs);
          const amounts = calculatePayrollAmounts({
            baseSalary: salary,
            overtimePay,
            statutory,
            taxSlabRate,
          });

          totalNetPaySum += amounts.netPay;

          const pdfBuffer = await this.payslipGenerator.generatePdfBuffer(
            employee.fullName,
            label,
            amounts,
          );
          const documentKey = `payslips/${tenantId}/${payrollRunId}/${employee.id}.pdf`;
          await this.storageService.upload(documentKey, pdfBuffer, 'application/pdf');

          payslipInserts.push({
            tenantId,
            payrollRunId,
            employeeId: employee.id,
            grossPay: amounts.grossPay,
            deductions: amounts.totalEmployeeDeductions,
            netPay: amounts.netPay,
            pdfUrl: documentKey,
          });
        }

        // Batch insert the chunk
        if (payslipInserts.length > 0) {
          await prisma.payslip.createMany({
            data: payslipInserts,
          });
        }

        totalProcessed += employees.length;
        skip += CHUNK_SIZE;

        // Report progress to BullMQ
        await job.updateProgress((totalProcessed / (totalProcessed + 1)) * 100);
      }

      // Mark run complete
      await prisma.payrollRun.updateMany({
        where: { id: payrollRunId, tenantId },
        data: {
          totalNetPay: totalNetPaySum.toFixed(4),
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      this.eventEmitter.emit('payroll.completed', {
        tenantId,
        payrollRunId,
        start,
        end,
        label,
      });

      AmdoxLogger.success(
        `Payroll run complete: ${label}`,
        `employees=${totalProcessed}  totalNetPay=${totalNetPaySum.toFixed(2)}`,
      );
      AmdoxLogger.event('Emitted payroll.completed', `runId=${payrollRunId}`);
    } catch (error: any) {
      AmdoxLogger.critical(
        `Payroll run FAILED: ${label}`,
        `runId=${payrollRunId}  err=${error.message}`,
      );
      await prisma.payrollRun.updateMany({
        where: { id: payrollRunId, tenantId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
