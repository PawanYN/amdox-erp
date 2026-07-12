import 'dotenv/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@amdox/db';
import { GlService } from '../src/finance/gl/gl.service';

/**
 * One-off backfill: post GL journal entries for any APPROVED AP invoice that
 * never got a corresponding journal entry.
 *
 * WHY: Earlier, `handleInvoiceApproved` silently no-op'd for tenants whose
 * chart of accounts lacked the standard codes (1300 Inventory / 2000 AP), so a
 * batch of approved invoices was left un-posted. The handler now self-heals
 * those accounts; this script re-runs the exact production posting logic for the
 * stragglers. It's idempotent — the handler skips any invoice that already has a
 * GL entry (sourceModule='AP', sourceId=invoice.id).
 */
const prisma = new PrismaClient();

async function backfill() {
  const glService = new GlService(new EventEmitter2());

  const approved = await prisma.invoice.findMany({
    where: { type: 'AP', status: 'APPROVED' },
    select: { id: true, tenantId: true, invoiceNumber: true, totalAmount: true },
  });

  console.log(`Found ${approved.length} approved AP invoice(s) to check.`);

  let posted = 0;
  let skipped = 0;

  for (const inv of approved) {
    const existing = await prisma.journalEntry.findFirst({
      where: { tenantId: inv.tenantId, sourceModule: 'AP', sourceId: inv.id },
    });
    if (existing) {
      skipped++;
      console.log(`  • ${inv.invoiceNumber}: GL entry already exists — skipped.`);
      continue;
    }

    await glService.handleInvoiceApproved({ tenantId: inv.tenantId, invoiceId: inv.id });

    const nowPosted = await prisma.journalEntry.findFirst({
      where: { tenantId: inv.tenantId, sourceModule: 'AP', sourceId: inv.id },
    });
    if (nowPosted) {
      posted++;
      console.log(
        `  ✓ ${inv.invoiceNumber}: posted GL entry ${nowPosted.reference} (₹${Number(inv.totalAmount)}).`,
      );
    } else {
      console.log(`  ✗ ${inv.invoiceNumber}: posting did not create an entry — investigate.`);
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
