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
import { PrismaClient, EmploymentStatus } from '@amdox/db';
import { Logger } from '@nestjs/common';
import { PayslipGenerator } from './payslip-generator';

@Processor('payroll')
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);
  private prisma = new PrismaClient();

  constructor(private readonly payslipGenerator: PayslipGenerator) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { payrollRunId, tenantId, start, end, label } = job.data;
    this.logger.log(`Starting payroll run processing for ${label} (ID: ${payrollRunId})`);

    try {
      // 1. Fetch dynamic tax slabs for this tenant
      const taxSlabs = await this.prisma.taxSlab.findMany({
        where: { tenantId },
        orderBy: { minSalary: 'asc' },
      });

      // Simple fallback if no slabs exist for this tenant
      const getDeductionRate = (salary: number) => {
        if (taxSlabs.length === 0) return 0.12; // Fallback to 12%
        const slab = taxSlabs.find(
          (s) => salary >= Number(s.minSalary) && (!s.maxSalary || salary <= Number(s.maxSalary))
        );
        return slab ? Number(slab.rate) : 0.12;
      };

      const CHUNK_SIZE = 500;
      let skip = 0;
      let totalProcessed = 0;
      let totalNetPaySum = 0;

      while (true) {
        // Fetch chunk of employees
        const employees = await this.prisma.employee.findMany({
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
        const attendanceRecords = await this.prisma.attendanceRecord.findMany({
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
          const relevantRecords = attendanceRecords.filter((record) => record.employeeId === employee.id);
          const overtimeMins = relevantRecords.reduce((sum, record) => sum + record.overtimeMins, 0);
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

          // Generate real PDF buffer 
          // (In a real app, we'd upload this to AWS S3 and save the URL, but here we'll mock the URL path)
          const pdfBuffer = await this.payslipGenerator.generatePdfBuffer(employee.fullName, label, {
            grossPay,
            deductions,
            netPay
          });

          payslipInserts.push({
            tenantId,
            payrollRunId,
            employeeId: employee.id,
            grossPay,
            deductions,
            netPay,
            pdfUrl: `/hr/payroll/${employee.id}/payslip.pdf`,
          });
        }

        // Batch insert the chunk
        if (payslipInserts.length > 0) {
          await this.prisma.payslip.createMany({
            data: payslipInserts,
          });
        }

        totalProcessed += employees.length;
        skip += CHUNK_SIZE;

        // Report progress to BullMQ
        await job.updateProgress((totalProcessed / (totalProcessed + 1)) * 100); 
      }

      // Mark run complete
      await this.prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          totalNetPay: totalNetPaySum.toFixed(4),
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      this.logger.log(`Completed payroll run for ${label}. Processed ${totalProcessed} employees.`);
    } catch (error: any) {
      this.logger.error(`Failed to process payroll run ${payrollRunId}: ${error.message}`);
      await this.prisma.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }
}
