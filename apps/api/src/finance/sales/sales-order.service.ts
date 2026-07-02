import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateSalesOrderDto } from '../dto/create-sales-order.dto';
import { InvoiceType } from '../dto/create-invoice.dto';

@Injectable()
export class SalesOrderService {
  private readonly logger = new Logger(SalesOrderService.name);
  private prisma = new PrismaClient();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async createSalesOrder(tenantId: string, dto: CreateSalesOrderDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, tenantId, isActive: true, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const orderNumber = `SO-${Date.now()}`;
    const lines = dto.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.quantity * line.unitPrice,
    }));
    const totalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.salesOrder.create({
        data: {
          tenantId,
          orderNumber,
          customerId: dto.customerId,
          currencyId: dto.currencyId,
          status: 'CONFIRMED',
          totalAmount,
          lines: {
            create: lines.map((line) => ({ tenantId, ...line })),
          },
        },
        include: { lines: true, customer: true },
      });

      this.eventEmitter.emit('sales.confirmed', {
        tenantId,
        salesOrderId: created.id,
        orderNumber: created.orderNumber,
      });

      return created;
    });

    this.logger.log(`Sales order ${order.orderNumber} confirmed`);
    return order;
  }

  async listSalesOrders(tenantId: string) {
    return this.prisma.salesOrder.findMany({
      where: { tenantId },
      include: { customer: true, lines: true, invoices: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSalesOrder(tenantId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId },
      include: { customer: true, lines: true, invoices: { include: { payments: true } } },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    return order;
  }

  async createInvoiceFromOrder(tenantId: string, salesOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.salesOrder.findFirst({
        where: { id: salesOrderId, tenantId },
        include: { lines: true, customer: true },
      });
      if (!order) throw new NotFoundException('Sales order not found');
      if (order.status === 'INVOICED' || order.status === 'FULFILLED') {
        throw new BadRequestException('Sales order already invoiced');
      }

      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);
      const invoiceNumber = `AR-${order.orderNumber}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          type: InvoiceType.AR,
          invoiceNumber,
          customerId: order.customerId,
          salesOrderId: order.id,
          currencyId: order.currencyId,
          issueDate,
          dueDate,
          totalAmount: order.totalAmount,
          status: 'APPROVED',
          lines: {
            create: order.lines.map((line) => ({
              tenantId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: { lines: true },
      });

      await tx.salesOrder.update({
        where: { id: order.id },
        data: { status: 'INVOICED' },
      });

      this.eventEmitter.emit('invoice.issued', { tenantId, invoiceId: invoice.id });
      this.eventEmitter.emit('sales.order_invoiced', {
        tenantId,
        salesOrderId: order.id,
        invoiceId: invoice.id,
      });

      await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'invoice.issued',
          payload: { invoiceId: invoice.id, salesOrderId: order.id },
          status: 'PENDING',
        },
      });

      return invoice;
    });
  }

  async getReconciliation(tenantId: string, salesOrderId: string) {
    const order = await this.getSalesOrder(tenantId, salesOrderId);
    const invoices = order.invoices.map((inv) => {
      const paid = inv.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const total = Number(inv.totalAmount);
      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        totalAmount: total,
        paidAmount: paid,
        balanceDue: Math.max(total - paid, 0),
        payments: inv.payments,
      };
    });
    const orderTotal = Number(order.totalAmount);
    const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

    return {
      salesOrderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      orderTotal,
      totalPaid,
      balanceDue: Math.max(orderTotal - totalPaid, 0),
      fullyReconciled: totalPaid >= orderTotal && orderTotal > 0,
      invoices,
    };
  }
}
