import 'dotenv/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@amdox/db';
import { GlService } from '../src/finance/gl/gl.service';

/**
 * One-off backfill: post the revenue GL entry (Dr AR / Cr Sales Revenue) for any
 * AR invoice that never got one.
 *
 * WHY: `handleInvoiceIssued` posts to account 4000 (Sales Revenue), but that code
 * was missing from the standard-accounts map, so `ensureStandardAccount('4000')`
 * threw and the revenue post was silently swallowed for every AR invoice. The map
 * now includes 4000; this re-runs the exact production posting logic for the
 * stragglers.
 *
 * Idempotent — the handler now skips any invoice that already has a GL entry
 * (sourceModule='AR', sourceId=invoice.id).
 */
const prisma = new PrismaClient();

async function backfill() {
  const glService = new GlService(new EventEmitter2());

  const invoices = await prisma.invoice.findMany({
    where: { type: 'AR' },
    select: { id: true, tenantId: true, invoiceNumber: true, totalAmount: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${invoices.length} AR invoice(s) to check.`);

  let posted = 0;
  let skipped = 0;

  for (const inv of invoices) {
    const existing = await prisma.journalEntry.findFirst({
      where: { tenantId: inv.tenantId, sourceModule: 'AR', sourceId: inv.id },
    });
    if (existing) {
      skipped++;
      console.log(`  • ${inv.invoiceNumber}: revenue GL entry already exists — skipped.`);
      continue;
    }

    await glService.handleInvoiceIssued({ tenantId: inv.tenantId, invoiceId: inv.id });

    const nowPosted = await prisma.journalEntry.findFirst({
      where: { tenantId: inv.tenantId, sourceModule: 'AR', sourceId: inv.id },
    });
    if (nowPosted) {
      posted++;
      console.log(
        `  ✓ ${inv.invoiceNumber}: posted revenue GL entry ${nowPosted.reference} (₹${Number(inv.totalAmount)}).`,
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
