import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { SetBudgetDto } from '../dto/set-budget.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

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
        overrunThresholdPct: dto.overrunThresholdPct || 10
      }
    });

    this.eventEmitter.emit('budget.set', { budgetId: budget.id, tenantId });
    return budget;
  }

  @OnEvent('cost.reported')
  async handleCostReported(payload: { projectId: string; amount: number; tenantId: string }) {
    this.logger.log(`Received cost report for project ${payload.projectId}: ${payload.amount}`);
    
    const budgets = await this.prisma.projectBudget.findMany({
      where: { projectId: payload.projectId, tenantId: payload.tenantId },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (budgets.length === 0) return;
    
    const budget = budgets[0];
    const newActual = Number(budget.actualAmount) + payload.amount;

    await this.prisma.projectBudget.update({
      where: { id: budget.id },
      data: { actualAmount: newActual }
    });

    const planned = Number(budget.plannedAmount);
    const threshold = Number(budget.overrunThresholdPct);
    const maxAllowed = planned + (planned * (threshold / 100));

    if (newActual > maxAllowed) {
      this.logger.warn(`Budget overrun for project ${payload.projectId}! Actual: ${newActual}, Allowed: ${maxAllowed}`);
      this.eventEmitter.emit('budget.overrun', { projectId: payload.projectId, actual: newActual, budget: planned, tenantId: payload.tenantId });
    }
  }
}
