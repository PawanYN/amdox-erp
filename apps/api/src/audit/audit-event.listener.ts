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

  @OnEvent('invoice.issued')
  async onInvoiceIssued(payload: { tenantId: string; invoiceId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'AR_INVOICE_ISSUED',
      entityType: 'Invoice',
      entityId: payload.invoiceId,
    });
  }

  @OnEvent('payment.received')
  async onPaymentReceived(payload: {
    tenantId: string;
    paymentId: string;
    invoiceId: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'PAYMENT_RECEIVED',
      entityType: 'Payment',
      entityId: payload.paymentId,
      afterState: { invoiceId: payload.invoiceId },
    });
  }

  @OnEvent('sales.confirmed')
  async onSalesConfirmed(payload: {
    tenantId: string;
    salesOrderId: string;
    orderNumber: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'SALES_ORDER_CONFIRMED',
      entityType: 'SalesOrder',
      entityId: payload.salesOrderId,
      afterState: { orderNumber: payload.orderNumber },
    });
  }

  @OnEvent('journal.entry.posted')
  async onJournalPosted(payload: {
    tenantId: string;
    journalEntryId: string;
    reference?: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'JOURNAL_ENTRY_POSTED',
      entityType: 'JournalEntry',
      entityId: payload.journalEntryId,
      afterState: { reference: payload.reference },
    });
  }

  @OnEvent('fiscal.period.closed')
  async onFiscalPeriodClosed(payload: {
    tenantId: string;
    periodId: string;
    periodName: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'FISCAL_PERIOD_CLOSED',
      entityType: 'FiscalPeriod',
      entityId: payload.periodId,
      afterState: { name: payload.periodName },
    });
  }

  @OnEvent('intercompany.transfer.created')
  async onIntercompanyTransfer(payload: {
    tenantId: string;
    transferId: string;
    amount: number;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'INTERCOMPANY_TRANSFER',
      entityType: 'IntercompanyTransfer',
      entityId: payload.transferId,
      afterState: { amount: payload.amount },
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

  @OnEvent('goods.received')
  async onGoodsReceived(payload: {
    tenantId: string;
    purchaseOrderId: string;
    goodsReceiptId: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'GOODS_RECEIVED',
      entityType: 'GoodsReceipt',
      entityId: payload.goodsReceiptId,
      afterState: { purchaseOrderId: payload.purchaseOrderId },
    });
  }

  @OnEvent('requisition.created')
  async onRequisitionCreated(payload: {
    tenantId: string;
    requisitionId: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'REQUISITION_CREATED',
      entityType: 'PurchaseRequisition',
      entityId: payload.requisitionId,
    });
  }

  @OnEvent('payroll.completed')
  async onPayrollCompleted(payload: {
    tenantId: string;
    payrollRunId: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'PAYROLL_COMPLETED',
      entityType: 'PayrollRun',
      entityId: payload.payrollRunId,
    });
  }

  @OnEvent('employee.created')
  async onEmployeeCreated(payload: { tenantId: string; employeeId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'EMPLOYEE_CREATED',
      entityType: 'Employee',
      entityId: payload.employeeId,
    });
  }

  @OnEvent('employee.updated')
  async onEmployeeUpdated(payload: { tenantId: string; employeeId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'EMPLOYEE_UPDATED',
      entityType: 'Employee',
      entityId: payload.employeeId,
    });
  }

  @OnEvent('employee.deleted')
  async onEmployeeDeleted(payload: { tenantId: string; employeeId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'EMPLOYEE_DELETED',
      entityType: 'Employee',
      entityId: payload.employeeId,
    });
  }

  @OnEvent('department.created')
  async onDepartmentCreated(payload: { tenantId: string; departmentId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'DEPARTMENT_CREATED',
      entityType: 'Department',
      entityId: payload.departmentId,
    });
  }

  @OnEvent('department.updated')
  async onDepartmentUpdated(payload: { tenantId: string; departmentId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'DEPARTMENT_UPDATED',
      entityType: 'Department',
      entityId: payload.departmentId,
    });
  }

  @OnEvent('department.deleted')
  async onDepartmentDeleted(payload: { tenantId: string; departmentId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'DEPARTMENT_DELETED',
      entityType: 'Department',
      entityId: payload.departmentId,
    });
  }

  @OnEvent('leave.status.changed')
  async onLeaveStatusChanged(payload: {
    tenantId: string;
    leaveId: string;
    status: string;
  }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'LEAVE_STATUS_CHANGED',
      entityType: 'LeaveRequest',
      entityId: payload.leaveId,
      afterState: { status: payload.status },
    });
  }

  @OnEvent('product.created')
  async onProductCreated(payload: { tenantId: string; productId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'PRODUCT_CREATED',
      entityType: 'Product',
      entityId: payload.productId,
    });
  }

  @OnEvent('product.updated')
  async onProductUpdated(payload: { tenantId: string; productId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'PRODUCT_UPDATED',
      entityType: 'Product',
      entityId: payload.productId,
    });
  }

  @OnEvent('product.deleted')
  async onProductDeleted(payload: { tenantId: string; productId: string }) {
    await this.auditService.record({
      tenantId: payload.tenantId,
      action: 'PRODUCT_DELETED',
      entityType: 'Product',
      entityId: payload.productId,
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
