import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationEventListener {
  constructor(private readonly notifications: NotificationService) {}

  @OnEvent('budget.overrun')
  async onBudgetOverrun(payload: {
    tenantId: string;
    projectId: string;
    actual: number;
    budget: number;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'budget.overrun',
      title: 'Budget overrun alert',
      body: `Project ${payload.projectId}: actual ${payload.actual} exceeds budget ${payload.budget} by >10%`,
    });
  }

  @OnEvent('po.created')
  async onPoCreated(payload: {
    tenantId: string;
    poId: string;
    poNumber?: string;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'po.created',
      title: 'Purchase order created',
      body: `PO ${payload.poNumber ?? payload.poId} was created`,
    });
  }

  @OnEvent('invoice.approved')
  async onInvoiceApproved(payload: { tenantId: string; invoiceId: string }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'invoice.approved',
      title: 'Invoice approved',
      body: `Invoice ${payload.invoiceId} approved (3-way match or manual)`,
    });
  }

  @OnEvent('project.created')
  async onProjectCreated(payload: { tenantId: string; projectId: string }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'project.created',
      title: 'New project created',
      body: `Project ${payload.projectId} is now active`,
    });
  }

  @OnEvent('reorder.triggered')
  async onReorder(payload: {
    tenantId: string;
    productSku: string;
    purchaseOrderId: string;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'reorder.triggered',
      title: 'Reorder automation triggered',
      body: `SKU ${payload.productSku}: draft PO ${payload.purchaseOrderId} created`,
    });
  }

  @OnEvent('requisition.created')
  async onRequisitionCreated(payload: {
    tenantId: string;
    requisitionId: string;
    projectId?: string;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'requisition.created',
      title: 'Project material request',
      body: payload.projectId
        ? `New requisition ${payload.requisitionId} for project ${payload.projectId}`
        : `New requisition ${payload.requisitionId}`,
    });
  }

  @OnEvent('milestone.overdue')
  async onMilestoneOverdue(payload: {
    tenantId: string;
    projectId: string;
    milestoneId: string;
    name: string;
    dueDate: Date | string;
  }) {
    const due =
      payload.dueDate instanceof Date
        ? payload.dueDate.toISOString().slice(0, 10)
        : String(payload.dueDate).slice(0, 10);
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'milestone.overdue',
      title: 'Milestone overdue',
      body: `"${payload.name}" on project ${payload.projectId} was due ${due}`,
    });
  }

  @OnEvent('milestone.achieved')
  async onMilestoneAchieved(payload: {
    tenantId: string;
    projectId: string;
    milestoneId: string;
    name: string;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'milestone.achieved',
      title: 'Milestone achieved',
      body: `"${payload.name}" completed on project ${payload.projectId}`,
    });
  }
}
