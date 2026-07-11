import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('@amdox/db', () => ({
  prisma: {
    invoice: { findFirst: vi.fn() },
    purchaseOrder: { findFirst: vi.fn() },
    goodsReceipt: { findFirst: vi.fn() },
  },
}));

import { prisma } from '@amdox/db';
import { InvoiceMatchingService } from './invoice-matching.service';

// Prisma Decimal stand-in — the service only calls .toNumber().
const dec = (n: number) => ({ toNumber: () => n });

const invoiceMock = prisma.invoice.findFirst as unknown as Mock;
const poMock = prisma.purchaseOrder.findFirst as unknown as Mock;
const grMock = prisma.goodsReceipt.findFirst as unknown as Mock;

function primeDocs(opts: {
  invoiceTotal: number;
  poTotal: number;
  invoiceVendor?: string;
  poVendor?: string;
  grBelongsToPo?: boolean;
}) {
  invoiceMock.mockResolvedValue({
    id: 'inv1',
    vendorId: opts.invoiceVendor ?? 'v1',
    totalAmount: dec(opts.invoiceTotal),
    lines: [],
  });
  poMock.mockResolvedValue({
    id: 'po1',
    vendorId: opts.poVendor ?? 'v1',
    totalAmount: dec(opts.poTotal),
    lines: [],
  });
  grMock.mockResolvedValue({
    id: 'gr1',
    purchaseOrderId: opts.grBelongsToPo === false ? 'other-po' : 'po1',
  });
}

describe('InvoiceMatchingService.performThreeWayMatch — 2% tolerance (F-03)', () => {
  let service: InvoiceMatchingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvoiceMatchingService();
  });

  it('passes when invoice total equals the PO total', async () => {
    primeDocs({ invoiceTotal: 1000, poTotal: 1000 });
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(true);
  });

  it('passes at exactly 2% difference (tolerance boundary is inclusive)', async () => {
    primeDocs({ invoiceTotal: 1020, poTotal: 1000 });
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(true);
  });

  it('fails just above the 2% tolerance', async () => {
    primeDocs({ invoiceTotal: 1021, poTotal: 1000 });
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(false);
  });

  it('applies the tolerance symmetrically to undercharges', async () => {
    primeDocs({ invoiceTotal: 979, poTotal: 1000 });
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(false);
  });

  it('fails when the invoice vendor differs from the PO vendor', async () => {
    primeDocs({ invoiceTotal: 1000, poTotal: 1000, invoiceVendor: 'v1', poVendor: 'v2' });
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(false);
  });

  it('fails when the goods receipt belongs to a different PO', async () => {
    primeDocs({ invoiceTotal: 1000, poTotal: 1000, grBelongsToPo: false });
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(false);
  });

  it('fails when any of the three documents is missing', async () => {
    primeDocs({ invoiceTotal: 1000, poTotal: 1000 });
    grMock.mockResolvedValue(null);
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(false);
  });

  it('never auto-approves against a zero-total PO', async () => {
    primeDocs({ invoiceTotal: 0, poTotal: 0 });
    expect(await service.performThreeWayMatch('t1', 'inv1', 'po1', 'gr1')).toBe(false);
  });
});
