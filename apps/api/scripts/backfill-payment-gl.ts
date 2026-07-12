import 'dotenv/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@amdox/db';
import { GlService } from '../src/finance/gl/gl.service';

/**
 * One-off backfill: post GL journal entries for any customer/vendor Payment that
 * never got a corresponding journal entry.
 *
 * WHY: Recording a payment (DB write) and posting it to the GL (async event
 * handler) are decoupled. If the `payment.received` / `payment.made` handler
 * threw once, the payment was still saved and the invoice marked PAID, but the
 * ledger entry was silently dropped with no retry. This re-runs the exact
 * production posting logic for those stragglers.
 *
 * Idempotent — the handlers now skip any payment that already has a GL entry
 * (sourceModule='AR'|'AP', sourceId=payment.id).
 */
const prisma = new PrismaClient();

async function backfill() {
  const glService = new GlService(new EventEmitter2());

  const payments = await prisma.payment.findMany({
    include: { invoice: { select: { type: true, invoiceNumber: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${payments.length} payment(s) to check.`);

  let posted = 0;
  let skipped = 0;

  for (const p of payments) {
    const module = p.invoice.type; // 'AR' or 'AP'
    const existing = await prisma.journalEntry.findFirst({
      where: { tenantId: p.tenantId, sourceModule: module, sourceId: p.id },
    });
    if (existing) {
      skipped++;
      console.log(
        `  • ${p.invoice.invoiceNumber} (${module}) ₹${Number(p.amount)}: GL entry already exists — skipped.`,
      );
      continue;
    }

    if (module === 'AR') {
      await glService.handlePaymentReceived({
        tenantId: p.tenantId,
        paymentId: p.id,
        invoiceId: p.invoiceId,
      });
    } else {
      await glService.handlePaymentMade({
        tenantId: p.tenantId,
        paymentId: p.id,
        invoiceId: p.invoiceId,
      });
    }

    const nowPosted = await prisma.journalEntry.findFirst({
      where: { tenantId: p.tenantId, sourceModule: module, sourceId: p.id },
    });
    if (nowPosted) {
      posted++;
      console.log(
        `  ✓ ${p.invoice.invoiceNumber} (${module}) ₹${Number(p.amount)}: posted GL entry ${nowPosted.reference}.`,
      );
    } else {
      console.log(
        `  ✗ ${p.invoice.invoiceNumber} (${module}) ₹${Number(p.amount)}: posting did not create an entry — investigate.`,
      );
    }
  }

  console.log(`\nDone. Posted ${posted}, skipped ${skipped}.`);
}

backfill()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
