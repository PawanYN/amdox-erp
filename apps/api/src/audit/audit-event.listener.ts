import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from './audit.service';

@Injectable()
export class AuditEventListener {
  constructor(private readonly auditService: AuditService) {}

  @OnEvent('invoice.approved')
  async onInvoiceApproved(payload: {
    tenantId: string;
    invoiceId: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'INVOICE_APPROVED',
      entityType: 'Invoice',
      entityId: payload.invoiceId,
      afterState: { status: 'APPROVED' },
    });
  }

  @OnEvent('po.created')
  async onPoCreated(payload: { tenantId: string; poId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'PO_CREATED',
      entityType: 'PurchaseOrder',
      entityId: payload.poId,
    });
  }

  @OnEvent('budget.overrun')
  async onBudgetOverrun(payload: {
    tenantId: string;
    projectId: string;
    actual: number;
    budget: number;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'BUDGET_OVERRUN',
      entityType: 'Project',
      entityId: payload.projectId,
      afterState: { actual: payload.actual, budget: payload.budget },
    });
  }

  @OnEvent('project.created')
  async onProjectCreated(payload: { tenantId: string; projectId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'PROJECT_CREATED',
      entityType: 'Project',
      entityId: payload.projectId,
    });
  }
}
