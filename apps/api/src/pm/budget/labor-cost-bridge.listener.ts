import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@amdox/db';

interface PayrollCompletedPayload {
  tenantId: string;
  payrollRunId: string;
  start: string;
  end: string;
  label: string;
}

/**
 * Allocates payroll labor cost to projects based on ResourceAllocation hours.
 * Emits cost.reported per (payslip, project) pair for BudgetService to consume.
 */
@Injectable()
export class LaborCostBridgeListener {
  private readonly logger = new Logger(LaborCostBridgeListener.name);
  private prisma = new PrismaClient();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('payroll.completed')
  async onPayrollCompleted(payload: PayrollCompletedPayload) {
    const periodStart = new Date(payload.start);
    const periodEnd = new Date(payload.end);

    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId: payload.tenantId, payrollRunId: payload.payrollRunId },
      include: { employee: { select: { fullName: true } } },
    });

    if (payslips.length === 0) {
      this.logger.warn(`No payslips found for payroll run ${payload.payrollRunId}`);
      return;
    }

    let emitted = 0;

    for (const payslip of payslips) {
      const allocations = await this.prisma.resourceAllocation.findMany({
        where: {
          tenantId: payload.tenantId,
          employeeId: payslip.employeeId,
          startDate: { lte: periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
        },
      });

      if (allocations.length === 0) continue;

      const totalHours = allocations.reduce(
        (sum, a) => sum + Number(a.allocatedHours),
        0,
      );
      if (totalHours <= 0) continue;

      const netPay = Number(payslip.netPay);

      for (const alloc of allocations) {
        const hours = Number(alloc.allocatedHours);
        const amount = Number(((netPay * hours) / totalHours).toFixed(4));
        if (amount <= 0) continue;

        this.eventEmitter.emit('cost.reported', {
          tenantId: payload.tenantId,
          projectId: alloc.projectId,
          amount,
          source: 'PAYROLL',
          sourceId: `${payslip.id}:${alloc.projectId}`,
          description: `Payroll ${payload.label} — ${payslip.employee.fullName} (${hours}h allocated)`,
        });
        emitted++;
      }
    }

    this.logger.log(
      `Payroll run ${payload.payrollRunId}: emitted ${emitted} labor cost.reported event(s)`,
    );
  }
}
