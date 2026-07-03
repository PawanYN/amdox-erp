import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { SetBudgetDto } from '../dto/set-budget.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

interface CostReportedPayload {
  tenantId: string;
  projectId: string;
  amount: number;
  source?: string;
  sourceId?: string;
  description?: string;
}

@Injectable()
export class BudgetService {
  private prisma = new PrismaClient();
  private readonly logger = new Logger(BudgetService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  async setBudget(tenantId: string, dto: SetBudgetDto) {
    const budget = await this.prisma.projectBudget.create({
      data: {
        tenantId,
        projectId: dto.projectId,
        plannedAmount: dto.plannedAmount,
        overrunThresholdPct: dto.overrunThresholdPct || 10,
      },
    });

    this.eventEmitter.emit('budget.set', {
      budgetId: budget.id,
      projectId: dto.projectId,
      tenantId,
      plannedAmount: Number(budget.plannedAmount),
    });
    return budget;
  }

  async listBudgets(tenantId: string) {
    const budgets = await this.prisma.projectBudget.findMany({
      where: { tenantId },
      include: { project: { select: { id: true, name: true, status: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return budgets.map((b) => {
      const planned = Number(b.plannedAmount);
      const actual = Number(b.actualAmount);
      const threshold = Number(b.overrunThresholdPct);
      const maxAllowed = planned + planned * (threshold / 100);
      return {
        ...b,
        plannedAmount: planned,
        actualAmount: actual,
        overrunThresholdPct: threshold,
        variancePct: planned > 0 ? Math.round(((actual - planned) / planned) * 100) : 0,
        isOverrun: actual > maxAllowed,
      };
    });
  }

  async getBudgetLines(tenantId: string, budgetId: string) {
    const lines = await this.prisma.projectBudgetLine.findMany({
      where: { tenantId, projectBudgetId: budgetId },
      orderBy: { id: 'desc' },
    });
    return lines.map((l) => ({
      id: l.id,
      description: l.description,
      amount: Number(l.amount),
      sourceModule: l.sourceModule,
      sourceId: l.sourceId,
    }));
  }

  @OnEvent('cost.reported')
  async handleCostReported(payload: CostReportedPayload) {
    const { tenantId, projectId, amount, source, sourceId, description } =
      payload;

    if (source && sourceId) {
      const existing = await this.prisma.projectBudgetLine.findFirst({
        where: { tenantId, sourceModule: source, sourceId },
      });
      if (existing) {
        this.logger.debug(
          `Skipping duplicate cost.reported ${source}:${sourceId}`,
        );
        return;
      }
    }

    this.logger.log(
      `Received cost report for project ${projectId}: ${amount}`,
    );

    const budgets = await this.prisma.projectBudget.findMany({
      where: { projectId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (budgets.length === 0) {
      this.logger.warn(`No budget found for project ${projectId}`);
      return;
    }

    const budget = budgets[0];
    const planned = Number(budget.plannedAmount);
    const threshold = Number(budget.overrunThresholdPct);
    const maxAllowed = planned + planned * (threshold / 100);

    const newActual = await this.prisma.$transaction(async (tx) => {
      await tx.projectBudgetLine.create({
        data: {
          tenantId,
          projectBudgetId: budget.id,
          description:
            description ?? `Cost from ${source ?? 'external'}`,
          amount,
          sourceModule: source,
          sourceId,
        },
      });

      const updated = await tx.projectBudget.update({
        where: { id: budget.id },
        data: { actualAmount: { increment: amount } },
      });

      return Number(updated.actualAmount);
    });

    if (newActual > maxAllowed) {
      this.logger.warn(
        `Budget overrun for project ${projectId}! Actual: ${newActual}, Allowed: ${maxAllowed}`,
      );
      this.eventEmitter.emit('budget.overrun', {
        projectId,
        actual: newActual,
        budget: planned,
        tenantId,
      });
    }
  }
}
