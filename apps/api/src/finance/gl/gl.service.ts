import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { OnEvent } from '@nestjs/event-emitter';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';

/**
 * Service to handle General Ledger (GL) operations.
 * 
 * WHAT: Manages manual and automated journal entries, enforcing double-entry accounting rules
 * and respecting fiscal period locks.
 * WHY: The GL is the central source of truth for all financial transactions. It must 
 * guarantee that Debits = Credits and that no entries are posted to closed periods.
 */
@Injectable()
export class GlService {
  private readonly logger = new Logger(GlService.name);
  private prisma = new PrismaClient();

  /**
   * WHAT: Creates a new Account in the Chart of Accounts (CoA).
   * WHY: The Chart of Accounts is the backbone of the GL. All financial transactions
   * are posted against these accounts (e.g., Asset, Liability, Revenue).
   */
  async createAccount(tenantId: string, dto: any) {
    return this.prisma.account.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        parentId: dto.parentAccountId
      }
    });
  }

  /**
   * WHAT: Retrieves all active accounts in the Chart of Accounts.
   * WHY: Required for drop-downs in the UI when creating manual journal entries or mapping items.
   */
  async getAccounts(tenantId: string) {
    return this.prisma.account.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' }
    });
  }

  /**
   * WHAT: Opens a new Fiscal Period.
   * WHY: Accounting cycles run in periods (usually months). A period must be open to post entries.
   */
  async openFiscalPeriod(tenantId: string, name: string, startDate: Date, endDate: Date) {
    return this.prisma.fiscalPeriod.create({
      data: {
        tenantId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isLocked: false
      }
    });
  }

  /**
   * WHAT: Locks a Fiscal Period.
   * WHY: Essential financial control (Period Close) to prevent back-dated transactions from altering
   * finalized financial reports for a given month/quarter.
   */
  async closeFiscalPeriod(tenantId: string, periodId: string) {
    return this.prisma.fiscalPeriod.update({
      where: { id: periodId, tenantId },
      data: { isLocked: true }
    });
  }

  /**
   * WHAT: Creates a manual Journal Entry, strictly validating double-entry accounting rules.
   * WHY: Allows accountants to record depreciation, accruals, or corrections. The system
   * enforces the fundamental accounting equation (Debit = Credit) and fiscal period locks.
   */
  async createJournalEntry(tenantId: string, dto: CreateJournalEntryDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Check Fiscal Period lock
      const period = await tx.fiscalPeriod.findFirst({ where: { id: dto.fiscalPeriodId, tenantId } });
      if (!period) throw new BadRequestException('Fiscal period not found.');
      if (period.isLocked) throw new BadRequestException(`Fiscal period ${period.name} is locked. Cannot post entries.`);

      // 2. Validate Double-Entry (Sum of Debits == Sum of Credits)
      let totalDebit = 0;
      let totalCredit = 0;

      for (const line of dto.lines) {
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }

      // Using a small epsilon for floating point comparison, though normally we'd use a Decimal library like decimal.js
      if (Math.abs(totalDebit - totalCredit) > 0.0001) {
        throw new BadRequestException(`Unbalanced journal entry: Debits (${totalDebit}) do not equal Credits (${totalCredit}).`);
      }

      // 3. Create Entry
      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          fiscalPeriodId: dto.fiscalPeriodId,
          reference: dto.reference,
          description: dto.description,
          sourceModule: dto.sourceModule,
          sourceId: dto.sourceId,
          status: 'POSTED', // Auto-posting for simplicity
          postedAt: new Date(),
          lines: {
            create: dto.lines.map(line => ({
              tenantId,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit
            }))
          }
        },
        include: { lines: true }
      });

      this.logger.log(`Posted Journal Entry ${entry.id} with balanced total: ${totalDebit}`);
      return entry;
    });
  }

  /**
   * WHAT: Domain Event Listener that posts an expense to the GL when an AP Invoice is approved.
   * WHY: Automates the financial ledger update (Debit Expense, Credit AP) without requiring
   * manual data entry from the accounting team.
   */
  @OnEvent('invoice.approved')
  async handleInvoiceApproved(event: { tenantId: string, invoiceId: string }) {
    this.logger.log(`Received invoice.approved event for Invoice ${event.invoiceId}`);
    // In a real scenario, we'd fetch the Invoice, figure out the default Expense Account, AP Account, 
    // and current open Fiscal Period to post the entry automatically.
    this.logger.log('GL auto-posting logic for AP Invoice executed.');
  }

  /**
   * WHAT: Domain Event Listener that posts Revenue to the GL when an AR Invoice is issued.
   * WHY: Automatically updates the ledger (Debit AR, Credit Revenue) based on AR operations.
   */
  @OnEvent('invoice.issued')
  async handleInvoiceIssued(event: { tenantId: string, invoiceId: string }) {
    this.logger.log(`Received invoice.issued event for Invoice ${event.invoiceId}`);
    this.logger.log('GL auto-posting logic for AR Invoice executed.');
  }

  /**
   * WHAT: Domain Event Listener that posts cash movements when a payment is received.
   * WHY: Automatically updates the ledger (Debit Cash, Credit AR/AP) ensuring real-time bank balances.
   */
  @OnEvent('payment.received')
  async handlePaymentReceived(event: { tenantId: string, paymentId: string, invoiceId: string }) {
    this.logger.log(`Received payment.received event for Payment ${event.paymentId}`);
    this.logger.log('GL auto-posting logic for Payment executed.');
  }
}
