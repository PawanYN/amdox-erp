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
    userId?: string;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'po.created',
      title: 'Purchase order created',
      body: `PO ${payload.poNumber ?? payload.poId} was created`,
      userId: payload.userId,
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
  async onProjectCreated(payload: { tenantId: string; projectId: string; userId?: string }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'project.created',
      title: 'New project created',
      body: `Project ${payload.projectId} is now active`,
      userId: payload.userId,
    });
  }

  @OnEvent('reorder.triggered')
  async onReorder(payload: { tenantId: string; productSku: string; purchaseOrderId: string }) {
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

  @OnEvent('payroll.completed')
  async onPayrollCompleted(payload: { tenantId: string; payrollRunId: string; label: string }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'payroll.completed',
      title: 'Payroll run completed',
      body: `Payroll for ${payload.label} processed. GL journal posted to accounts 6000/2100.`,
    });
  }

  @OnEvent('leave.status.changed')
  async onLeaveStatusChanged(payload: {
    tenantId: string;
    leaveId: string;
    status: string;
    userId?: string;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'leave.status.changed',
      title: `Leave request ${payload.status.toLowerCase()}`,
      body: `Leave request ${payload.leaveId} is now ${payload.status}`,
      userId: payload.userId,
    });
  }

  @OnEvent('budget.overrun')
  async onBudgetOverrunWebhook(_payload: {
    tenantId: string;
    projectId: string;
    actual: number;
    budget: number;
  }) {
    // budget.overrun is already handled above — this handler is deduplicated by NestJS
    // so we only add it once. The original handler above covers it.
  }

  @OnEvent('employee.created')
  async onEmployeeCreated(payload: { tenantId: string; employeeId: string; userId?: string }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'employee.created',
      title: 'New employee added',
      body: `Employee ${payload.employeeId} has been onboarded`,
      userId: payload.userId,
    });
  }

  @OnEvent('invoice.issued')
  async onInvoiceIssued(payload: { tenantId: string; invoiceId: string; invoiceNumber?: string }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'invoice.issued',
      title: 'AR invoice issued',
      body: `Invoice ${payload.invoiceNumber ?? payload.invoiceId} raised to customer`,
    });
  }

  @OnEvent('forecast.mape_breach')
  async onForecastMapeBreach(payload: {
    tenantId: string;
    productId: string;
    sku: string;
    mape: number;
    modelType?: string;
  }) {
    await this.notifications.notify({
      tenantId: payload.tenantId,
      eventType: 'forecast.mape_breach',
      title: 'Forecast accuracy below target',
      body: `SKU ${payload.sku}: MAPE ${(payload.mape * 100).toFixed(1)}% exceeds the <12% target (${payload.modelType ?? 'model'})`,
    });
  }
}
