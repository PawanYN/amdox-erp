import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateInvoiceDto, InvoiceType } from '../dto/create-invoice.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';

/**
 * Service to handle Accounts Receivable (AR) operations.
 * 
 * WHAT: Manages the lifecycle of customer invoices and the payments received against them.
 * WHY: This tracks money owed to the company (receivables) and ensures proper matching
 * of incoming cash to outstanding invoices, integrating with the GL via domain events.
 */
@Injectable()
export class ArService {
  private readonly logger = new Logger(ArService.name);
  private prisma = new PrismaClient();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * WHAT: Generates a new receivable invoice for a customer.
   * WHY: When goods or services are provided to a customer, an AR invoice must be created
   * to request payment. This also emits an event to recognize revenue in the GL.
   */
  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    if (dto.type !== InvoiceType.AR) {
      throw new Error('AR Service only handles AR invoices.');
    }

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          type: dto.type,
          invoiceNumber: dto.invoiceNumber,
          customerId: dto.customerId,
          currencyId: dto.currencyId,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          totalAmount: dto.totalAmount,
          status: 'APPROVED', // AR invoices are typically approved upon creation (sent to customer)
          lines: {
            create: dto.lines.map(line => ({
              tenantId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal
            }))
          }
        },
        include: { lines: true }
      });

      // AR Invoices emit an event when issued to post to the GL (Debit AR, Credit Revenue)
      this.eventEmitter.emit('invoice.issued', {
        tenantId,
        invoiceId: invoice.id
      });

      await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'invoice.issued',
          payload: { invoiceId: invoice.id, totalAmount: invoice.totalAmount },
          status: 'PENDING'
        }
      });

      return invoice;
    });
  }

  /**
   * WHAT: Records a payment received from a customer against an outstanding AR invoice.
   * WHY: Reduces the customer's outstanding balance, marks the invoice as PAID if fully settled,
   * and triggers the GL event to debit Cash and credit Accounts Receivable.
   */
  async recordPayment(tenantId: string, dto: RecordPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: dto.invoiceId, tenantId, type: 'AR' } });
      
      if (!invoice) {
        throw new NotFoundException('AR Invoice not found.');
      }

      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          amount: dto.amount,
          status: 'COMPLETED',
          paidAt: new Date()
        }
      });

      // Update invoice status if fully paid
      if (dto.amount >= invoice.totalAmount.toNumber()) {
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID' }
        });
      }

      // Emit payment received event (Debit Cash, Credit AR)
      this.eventEmitter.emit('payment.received', {
        tenantId,
        paymentId: payment.id,
        invoiceId: invoice.id
      });

      await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'payment.received',
          payload: { paymentId: payment.id, invoiceId: invoice.id, amount: payment.amount },
          status: 'PENDING'
        }
      });

      return payment;
    });
  }

  /**
   * WHAT: Generates an aging report categorizing outstanding invoices by how long they have been unpaid.
   * WHY: Crucial financial metric for managing cash flow and identifying delinquent accounts.
   */
  async getAgingReport(tenantId: string) {
    const now = new Date();
    
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId,
        type: 'AR',
        status: { in: ['APPROVED', 'OVERDUE'] }
      }
    });

    const report = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0
    };

    for (const inv of invoices) {
      const diffTime = Math.abs(now.getTime() - inv.dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const amount = inv.totalAmount.toNumber();

      if (diffDays <= 30) report['0-30'] += amount;
      else if (diffDays <= 60) report['31-60'] += amount;
      else if (diffDays <= 90) report['61-90'] += amount;
      else report['90+'] += amount;
    }

    return report;
  }
}
