import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AmdoxLogger } from '../../infrastructure/common/logger/amdox-logger';
import { prisma } from '@amdox/db';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { CreateJournalEntryDto } from '../dto/create-journal-entry.dto';
import { CreateIntercompanyTransferDto } from '../dto/create-intercompany-transfer.dto';
import { SearchService } from '../../infrastructure/search/search.service';

/**
 * Service to handle General Ledger (GL) operations.
 *
 * WHAT: Manages manual and automated journal entries, enforcing double-entry accounting rules
 * and respecting fiscal period locks.
 * WHY: The GL is the central source of truth for all financial transactions. It must
 * guarantee that Debits = Credits and that no entries are posted to closed periods.
 */
@Injectable()
export class JournalEntryService {
  private readonly logger = new Logger(JournalEntryService.name);
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly searchService: SearchService,
  ) {}

  /**
   * WHAT: Creates a new Account in the Chart of Accounts (CoA).
   * WHY: The Chart of Accounts is the backbone of the GL. All financial transactions
   * are posted against these accounts (e.g., Asset, Liability, Revenue).
   */
  async createAccount(tenantId: string, dto: any) {
    return prisma.account.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        parentId: dto.parentAccountId,
      },
    });
  }

  /**
   * The default chart-of-accounts codes the automated GL postings rely on.
   * Kept in one place so every auto-posting path (AP, AR, payments, payroll)
   * references the same standard accounts.
   */
  private static readonly STANDARD_ACCOUNTS: Record<
    string,
    { name: string; type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' }
  > = {
    '1000': { name: 'Cash', type: 'ASSET' },
    '1200': { name: 'Accounts Receivable', type: 'ASSET' },
    '1300': { name: 'Inventory', type: 'ASSET' },
    '2000': { name: 'Accounts Payable', type: 'LIABILITY' },
    '2100': { name: 'Payroll Payable', type: 'LIABILITY' },
    '4000': { name: 'Sales Revenue', type: 'REVENUE' },
    '6000': { name: 'Salary Expense', type: 'EXPENSE' },
  };

  /**
   * WHAT: Infers an account type from the leading digit of its code, following the
   * conventional chart-of-accounts numbering (1xxx assets, 2xxx liabilities, etc.).
   * WHY: Lets us auto-create an account for any code that isn't in the static map,
   * so a valid posting is never blocked just because a code wasn't pre-registered.
   */
  private static inferAccountType(
    code: string,
  ): 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE' {
    switch (code.trim().charAt(0)) {
      case '1':
        return 'ASSET';
      case '2':
        return 'LIABILITY';
      case '3':
        return 'EQUITY';
      case '4':
        return 'REVENUE';
      default:
        return 'EXPENSE'; // 5xxx / 6xxx and anything else
    }
  }

  /**
   * WHAT: Returns the GL account for `code`, DB-first — using an existing account if
   * present, otherwise creating one on demand.
   * WHY: The chart of accounts (the `Account` table) is the source of truth. Auto-
   * postings must use whatever account exists there; they must NOT reject a valid,
   * existing account just because its code isn't in the static `STANDARD_ACCOUNTS`
   * map. That map is now only a source of nice default names/types when an account
   * has to be auto-created; unknown codes fall back to a name/type inferred from the
   * code prefix so no posting ever fails with "Unknown standard account code".
   */
  private async ensureStandardAccount(tenantId: string, code: string) {
    // 1. Source of truth: use the account from the chart of accounts if it exists.
    const existing = await prisma.account.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (existing) return existing;

    // 2. Not found — auto-create it, preferring the standard map for name/type and
    //    falling back to a code-inferred default so a valid posting is never blocked.
    const def = JournalEntryService.STANDARD_ACCOUNTS[code] ?? {
      name: `Account ${code}`,
      type: JournalEntryService.inferAccountType(code),
    };
    return prisma.account.upsert({
      where: { tenantId_code: { tenantId, code } },
      update: {},
      create: { tenantId, code, name: def.name, type: def.type, isActive: true },
    });
  }

  /**
   * WHAT: Retrieves all active accounts in the Chart of Accounts.
   * WHY: Required for drop-downs in the UI when creating manual journal entries or mapping items.
   */
  async getAccounts(tenantId: string) {
    return prisma.account.findMany({
      where: { tenantId, isActive: true },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * WHAT: Returns per-account GL balances by summing posted journal lines (debit − credit).
   * WHY: Chart of Accounts KPIs and row balances need live ledger totals, not metadata-only CoA rows.
   */
  async getAccountBalances(tenantId: string) {
    const accounts = await prisma.account.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, code: true },
      orderBy: { code: 'asc' },
    });

    const aggregates = await prisma.journalLine.groupBy({
      by: ['accountId'],
      where: {
        tenantId,
        journalEntry: { status: 'POSTED', deletedAt: null },
      },
      _sum: { debit: true, credit: true },
    });

    const balanceByAccountId = new Map(
      aggregates.map((row) => [
        row.accountId,
        Number(row._sum.debit ?? 0) - Number(row._sum.credit ?? 0),
      ]),
    );

    return accounts.map((account) => ({
      accountId: account.id,
      code: account.code,
      balance: balanceByAccountId.get(account.id) ?? 0,
    }));
  }

  /**
   * WHAT: Opens a new Fiscal Period.
   * WHY: Accounting cycles run in periods (usually months). A period must be open to post entries.
   */
  async openFiscalPeriod(tenantId: string, name: string, startDate: Date, endDate: Date) {
    return prisma.fiscalPeriod.create({
      data: {
        tenantId,
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isLocked: false,
      },
    });
  }

  /**
   * WHAT: Locks a Fiscal Period.
   * WHY: Essential financial control (Period Close) to prevent back-dated transactions from altering
   * finalized financial reports for a given month/quarter.
   */
  async closeFiscalPeriod(tenantId: string, periodId: string, actingUserId?: string) {
    const period = await prisma.fiscalPeriod.update({
      where: { id: periodId, tenantId },
      data: { isLocked: true },
    });
    this.eventEmitter.emit('fiscal.period.closed', {
      tenantId,
      periodId,
      periodName: period.name,
      userId: actingUserId,
    });
    return period;
  }

  async getOrCreateCurrentFiscalPeriod(tenantId: string) {
    const now = new Date();
    const periodName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let period = await prisma.fiscalPeriod.findUnique({
      where: { tenantId_name: { tenantId, name: periodName } },
    });
    if (!period) {
      period = await this.openFiscalPeriod(
        tenantId,
        periodName,
        new Date(now.getFullYear(), now.getMonth(), 1),
        new Date(now.getFullYear(), now.getMonth() + 1, 0),
      );
    }
    return period;
  }

  async listFiscalPeriods(tenantId: string) {
    return prisma.fiscalPeriod.findMany({
      where: { tenantId },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * WHAT: Creates a manual Journal Entry, strictly validating double-entry accounting rules.
   * WHY: Allows accountants to record depreciation, accruals, or corrections. The system
   * enforces the fundamental accounting equation (Debit = Credit) and fiscal period locks.
   */
  async createJournalEntry(tenantId: string, dto: CreateJournalEntryDto, actingUserId?: string) {
    const entry = await prisma.$transaction(async (tx) => {
      // 1. Check Fiscal Period lock
      const period = await tx.fiscalPeriod.findFirst({
        where: { id: dto.fiscalPeriodId, tenantId },
      });
      if (!period) throw new BadRequestException('Fiscal period not found.');
      if (period.isLocked)
        throw new BadRequestException(
          `Fiscal period ${period.name} is locked. Cannot post entries.`,
        );

      // 2. Validate Double-Entry (Sum of Debits == Sum of Credits)
      let totalDebit = 0;
      let totalCredit = 0;

      for (const line of dto.lines) {
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }

      // Using a small epsilon for floating point comparison, though normally we'd use a Decimal library like decimal.js
      if (Math.abs(totalDebit - totalCredit) > 0.0001) {
        throw new BadRequestException(
          `Unbalanced journal entry: Debits (${totalDebit}) do not equal Credits (${totalCredit}).`,
        );
      }

      // 3. Create Entry
      const txEntry = await tx.journalEntry.create({
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
            create: dto.lines.map((line) => ({
              tenantId,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
        include: { lines: true },
      });

      AmdoxLogger.finance(
        `Journal entry posted  ref=${txEntry.reference}`,
        `total=${totalDebit}  id=${txEntry.id}`,
      );
      this.eventEmitter.emit('journal.entry.posted', {
        tenantId,
        journalEntryId: txEntry.id,
        reference: txEntry.reference,
        userId: actingUserId,
      });
      return txEntry;
    });

    this.searchService.indexJournalEntry({
      id: entry.id,
      tenantId: entry.tenantId,
      reference: entry.reference,
      description: entry.description,
      sourceModule: entry.sourceModule,
      status: entry.status,
    });
    return entry;
  }

  async getJournalEntries(tenantId: string, limit = 100) {
    return prisma.journalEntry.findMany({
      where: { tenantId },
      include: {
        lines: { include: { account: true } },
        fiscalPeriod: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * WHAT: Domain Event Listener that posts an expense to the GL when an AP Invoice is approved.
   * WHY: Automates the financial ledger update (Debit Expense, Credit AP) without requiring
   * manual data entry from the accounting team.
   */
  @OnEvent('invoice.approved')
  async handleInvoiceApproved(event: { tenantId: string; invoiceId: string }) {
    AmdoxLogger.event('invoice.approved → GL posting', `invoiceId=${event.invoiceId}`);

    // 1. Fetch the invoice
    const invoice = await prisma.invoice.findFirst({
      where: { id: event.invoiceId, tenantId: event.tenantId },
    });
    if (!invoice) return;

    const amount = Number(invoice.totalAmount);
    if (amount <= 0) return;

    // Prevent duplicate GL postings if invoice.approved is delivered more than once.
    const duplicate = await prisma.journalEntry.findFirst({
      where: { tenantId: event.tenantId, sourceModule: 'AP', sourceId: invoice.id },
    });
    if (duplicate) {
      this.logger.debug(`GL entry for AP invoice ${invoice.id} already exists — skipping.`);
      return;
    }

    // 2. Fetch or create current Fiscal Period (e.g., '2026-07')
    const now = new Date();
    const periodName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let period = await prisma.fiscalPeriod.findUnique({
      where: { tenantId_name: { tenantId: event.tenantId, name: periodName } },
    });
    if (!period) {
      period = await this.openFiscalPeriod(
        event.tenantId,
        periodName,
        new Date(now.getFullYear(), now.getMonth(), 1),
        new Date(now.getFullYear(), now.getMonth() + 1, 0),
      );
    }

    // 3. Fetch standard Accounts (1300 = Inventory, 2000 = AP), creating them
    // on first use so the AP → GL posting never silently no-ops for a tenant
    // whose chart of accounts wasn't pre-seeded.
    const [invAccount, apAccount] = await Promise.all([
      this.ensureStandardAccount(event.tenantId, '1300'),
      this.ensureStandardAccount(event.tenantId, '2000'),
    ]);

    // 4. Create the Journal Entry
    try {
      await this.createJournalEntry(event.tenantId, {
        fiscalPeriodId: period.id,
        reference: `INV-${invoice.invoiceNumber}`,
        description: `Auto-posting for AP Invoice ${invoice.invoiceNumber}`,
        sourceModule: 'AP',
        sourceId: invoice.id,
        lines: [
          { accountId: invAccount.id, debit: amount, credit: 0 },
          { accountId: apAccount.id, debit: 0, credit: amount },
        ],
      });
      AmdoxLogger.finance(
        `AP invoice posted to GL  Dr1300/Cr2000`,
        `inv=${invoice.invoiceNumber}  amount=${amount}`,
      );
    } catch (err) {
      AmdoxLogger.error(
        `GL posting failed for AP invoice ${invoice.invoiceNumber}`,
        (err as Error).message,
      );
    }
  }

  async listIntercompanyTransfers(tenantId: string) {
    return prisma.intercompanyTransfer.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createIntercompanyTransfer(
    tenantId: string,
    dto: CreateIntercompanyTransferDto,
    actingUserId?: string,
  ) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Source and destination accounts must differ.');
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('Transfer amount must be positive.');
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: dto.fromAccountId, tenantId, isActive: true } }),
      prisma.account.findFirst({ where: { id: dto.toAccountId, tenantId, isActive: true } }),
    ]);
    if (!fromAccount || !toAccount) {
      throw new BadRequestException('Both intercompany accounts must exist and be active.');
    }

    const period = await this.getOrCreateCurrentFiscalPeriod(tenantId);

    const transfer = await prisma.intercompanyTransfer.create({
      data: {
        tenantId,
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amount: dto.amount,
        description: dto.description,
      },
    });

    await this.createJournalEntry(tenantId, {
      fiscalPeriodId: period.id,
      reference: `IC-${transfer.id.slice(0, 8)}`,
      description:
        dto.description || `Intercompany transfer ${fromAccount.code} → ${toAccount.code}`,
      sourceModule: 'IC',
      sourceId: transfer.id,
      lines: [
        { accountId: toAccount.id, debit: dto.amount, credit: 0 },
        { accountId: fromAccount.id, debit: 0, credit: dto.amount },
      ],
    });

    this.eventEmitter.emit('intercompany.transfer.created', {
      tenantId,
      transferId: transfer.id,
      amount: dto.amount,
      userId: actingUserId,
    });

    return transfer;
  }

  private async postArGlEntry(
    tenantId: string,
    reference: string,
    description: string,
    sourceModule: string,
    sourceId: string,
    debitAccountCode: string,
    creditAccountCode: string,
    amount: number,
  ) {
    const period = await this.getOrCreateCurrentFiscalPeriod(tenantId);
    const [debitAccount, creditAccount] = await Promise.all([
      this.ensureStandardAccount(tenantId, debitAccountCode),
      this.ensureStandardAccount(tenantId, creditAccountCode),
    ]);

    await this.createJournalEntry(tenantId, {
      fiscalPeriodId: period.id,
      reference,
      description,
      sourceModule,
      sourceId,
      lines: [
        { accountId: debitAccount.id, debit: amount, credit: 0 },
        { accountId: creditAccount.id, debit: 0, credit: amount },
      ],
    });
  }

  /**
   * WHAT: Domain Event Listener that posts Revenue to the GL when an AR Invoice is issued.
   * WHY: Automatically updates the ledger (Debit AR, Credit Revenue) based on AR operations.
   */
  @OnEvent('invoice.issued')
  async handleInvoiceIssued(event: { tenantId: string; invoiceId: string }) {
    AmdoxLogger.event('invoice.issued → GL posting', `invoiceId=${event.invoiceId}`);

    const invoice = await prisma.invoice.findFirst({
      where: { id: event.invoiceId, tenantId: event.tenantId },
    });
    if (!invoice || invoice.type !== 'AR') return;

    const amount = Number(invoice.totalAmount);
    if (amount <= 0) return;

    // Prevent duplicate revenue postings if invoice.issued is delivered more than once.
    const duplicate = await prisma.journalEntry.findFirst({
      where: { tenantId: event.tenantId, sourceModule: 'AR', sourceId: invoice.id },
    });
    if (duplicate) {
      this.logger.debug(`GL revenue entry for AR invoice ${invoice.id} already exists — skipping.`);
      return;
    }

    try {
      await this.postArGlEntry(
        event.tenantId,
        `AR-${invoice.invoiceNumber}`,
        `AR invoice issued ${invoice.invoiceNumber}`,
        'AR',
        invoice.id,
        '1200',
        '4000',
        amount,
      );
      AmdoxLogger.finance(
        `AR invoice posted to GL  Dr1200/Cr4000`,
        `inv=${invoice.invoiceNumber}  amount=${amount}`,
      );
    } catch (err) {
      AmdoxLogger.error(
        `GL posting failed for AR invoice ${invoice.invoiceNumber}`,
        (err as Error).message,
      );
    }
  }

  /**
   * WHAT: Domain Event Listener that posts a payroll expense to the GL when payroll completes.
   * WHY: Automates the financial ledger update (Debit Salary Expense, Credit Payroll Payable)
   * so the P&L reflects payroll costs without manual intervention.
   * INT-05: HR → Finance (payroll) integration.
   */
  @OnEvent('payroll.completed')
  async handlePayrollCompleted(event: { tenantId: string; payrollRunId: string; label: string }) {
    AmdoxLogger.event(
      'payroll.completed → GL entry',
      `run=${event.payrollRunId}  label=${event.label}`,
    );

    const payrollRun = await prisma.payrollRun.findFirst({
      where: { id: event.payrollRunId, tenantId: event.tenantId },
    });
    if (!payrollRun || !payrollRun.totalNetPay) {
      AmdoxLogger.warn(
        'Payroll run not found or missing totalNetPay — GL post skipped',
        `runId=${event.payrollRunId}`,
      );
      return;
    }

    const amount = Number(payrollRun.totalNetPay);
    if (amount <= 0) return;

    // Prevent duplicate GL postings for the same payroll run
    const duplicate = await prisma.journalEntry.findFirst({
      where: { tenantId: event.tenantId, sourceModule: 'PAYROLL', sourceId: event.payrollRunId },
    });
    if (duplicate) {
      this.logger.debug(
        `GL entry for payroll run ${event.payrollRunId} already exists — skipping.`,
      );
      return;
    }

    const period = await this.getOrCreateCurrentFiscalPeriod(event.tenantId);

    // Upsert payroll-specific accounts if they don't exist yet
    const [salaryAccount, payrollPayableAccount] = await Promise.all([
      this.ensureStandardAccount(event.tenantId, '6000'),
      this.ensureStandardAccount(event.tenantId, '2100'),
    ]);

    try {
      await this.createJournalEntry(event.tenantId, {
        fiscalPeriodId: period.id,
        reference: `PAYROLL-${event.payrollRunId.slice(0, 8)}`,
        description: `Payroll run — ${event.label} (total net pay: ${amount.toLocaleString()})`,
        sourceModule: 'PAYROLL',
        sourceId: event.payrollRunId,
        lines: [
          { accountId: salaryAccount.id, debit: amount, credit: 0 },
          { accountId: payrollPayableAccount.id, debit: 0, credit: amount },
        ],
      });
      AmdoxLogger.finance(
        `Payroll GL entry posted  Dr6000/Cr2100`,
        `runId=${event.payrollRunId}  amount=${amount}`,
      );
    } catch (err) {
      AmdoxLogger.critical(
        `Payroll GL post FAILED`,
        `runId=${event.payrollRunId}  err=${(err as Error).message}`,
      );
    }
  }

  /**
   * WHAT: Domain Event Listener that posts cash movements when a payment is received.
   * WHY: Automatically updates the ledger (Debit Cash, Credit AR) ensuring real-time bank balances.
   */
  @OnEvent('payment.received')
  async handlePaymentReceived(event: {
    tenantId: string;
    paymentId: string;
    invoiceId: string;
    amount?: number;
  }) {
    AmdoxLogger.event('payment.received → GL posting', `paymentId=${event.paymentId}`);

    const payment = await prisma.payment.findFirst({
      where: { id: event.paymentId, tenantId: event.tenantId },
      include: { invoice: true },
    });
    if (!payment) return;

    const amount = event.amount ?? Number(payment.amount);
    if (amount <= 0) return;

    // Prevent duplicate GL postings if payment.received is delivered more than once.
    const duplicate = await prisma.journalEntry.findFirst({
      where: { tenantId: event.tenantId, sourceModule: 'AR', sourceId: payment.id },
    });
    if (duplicate) {
      this.logger.debug(`GL entry for AR payment ${payment.id} already exists — skipping.`);
      return;
    }

    try {
      await this.postArGlEntry(
        event.tenantId,
        `PAY-${payment.id.slice(0, 8)}`,
        `Payment received for invoice ${payment.invoice.invoiceNumber}`,
        'AR',
        payment.id,
        '1000',
        '1200',
        amount,
      );
      AmdoxLogger.finance(
        `Payment posted to GL  Dr1000/Cr1200`,
        `paymentId=${payment.id}  amount=${amount}`,
      );
    } catch (err) {
      AmdoxLogger.error(`GL posting failed for payment ${payment.id}`, (err as Error).message);
    }
  }

  /**
   * WHAT: Domain Event Listener that posts cash movements when a vendor payment is made.
   * WHY: Automatically updates the ledger (Debit AP Payable, Credit Cash) — the disbursement
   * counterpart to the `invoice.approved` Dr Inventory/Cr AP posting.
   */
  @OnEvent('payment.made')
  async handlePaymentMade(event: {
    tenantId: string;
    paymentId: string;
    invoiceId: string;
    amount?: number;
  }) {
    AmdoxLogger.event('payment.made → GL posting', `paymentId=${event.paymentId}`);

    const payment = await prisma.payment.findFirst({
      where: { id: event.paymentId, tenantId: event.tenantId },
      include: { invoice: true },
    });
    if (!payment) return;

    const amount = event.amount ?? Number(payment.amount);
    if (amount <= 0) return;

    // Prevent duplicate GL postings if payment.made is delivered more than once.
    const duplicate = await prisma.journalEntry.findFirst({
      where: { tenantId: event.tenantId, sourceModule: 'AP', sourceId: payment.id },
    });
    if (duplicate) {
      this.logger.debug(`GL entry for AP payment ${payment.id} already exists — skipping.`);
      return;
    }

    try {
      await this.postArGlEntry(
        event.tenantId,
        `PAY-${payment.id.slice(0, 8)}`,
        `Payment made for invoice ${payment.invoice.invoiceNumber}`,
        'AP',
        payment.id,
        '2000',
        '1000',
        amount,
      );
      AmdoxLogger.finance(
        `Payment posted to GL  Dr2000/Cr1000`,
        `paymentId=${payment.id}  amount=${amount}`,
      );
    } catch (err) {
      AmdoxLogger.error(`GL posting failed for payment ${payment.id}`, (err as Error).message);
    }
  }
}
