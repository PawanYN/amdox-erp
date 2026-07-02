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
}
