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
 * - For each employee, it looks up their dynamic `TaxSlab` (instead of a hardcoded 12%).
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

@Processor('payroll')
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);
  constructor(
    private readonly payslipGenerator: PayslipGenerator,
    private readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { payrollRunId, tenantId, start, end, label } = job.data;
    AmdoxLogger.hr(`Payroll run started: ${label}`, `runId=${payrollRunId}  tenant=${tenantId}`);

    try {
      // 1. Fetch dynamic tax slabs for this tenant
      const taxSlabs = await prisma.taxSlab.findMany({
        where: { tenantId },
        orderBy: { minSalary: 'asc' },
      });

      // Simple fallback if no slabs exist for this tenant
      const getDeductionRate = (salary: number) => {
        if (taxSlabs.length === 0) return 0.12; // Fallback to 12%
        const slab = taxSlabs.find(
          (s) => salary >= Number(s.minSalary) && (!s.maxSalary || salary <= Number(s.maxSalary)),
        );
        return slab ? Number(slab.rate) : 0.12;
      };

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

          // Financial math
          const salary = Number(contract.salary);
          const monthlyHours = 160;
          const hourlyRate = salary / monthlyHours;
          const overtimePay = overtimeHours * hourlyRate * 1.5;
          const grossPay = Number((salary + overtimePay).toFixed(4));

          const deductionRate = getDeductionRate(salary);
          const deductions = Number((grossPay * deductionRate).toFixed(4));
          const netPay = Number((grossPay - deductions).toFixed(4));

          totalNetPaySum += netPay;

          // Generate the PDF now so a broken payslip template fails the run early, rather
          // than silently at download time, and persist it to object storage (MinIO in
          // dev/kind, real S3/R2 in production — StorageService) so the download endpoint
          // can serve the stored file instead of regenerating it every time. Keyed by
          // payrollRunId+employeeId, both known before the batch insert below assigns
          // each Payslip row its own id.
          const pdfBuffer = await this.payslipGenerator.generatePdfBuffer(
            employee.fullName,
            label,
            { grossPay, deductions, netPay },
          );
          const documentKey = `payslips/${tenantId}/${payrollRunId}/${employee.id}.pdf`;
          await this.storageService.upload(documentKey, pdfBuffer, 'application/pdf');

          payslipInserts.push({
            tenantId,
            payrollRunId,
            employeeId: employee.id,
            grossPay,
            deductions,
            netPay,
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
