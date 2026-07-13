import { describe, it, expect, beforeEach } from 'vitest';
import { InvoiceMatchingService, type ThreeWayMatchInput } from './invoice-matching.service';

function baseInput(overrides: Partial<ThreeWayMatchInput> = {}): ThreeWayMatchInput {
  return {
    invoiceVendorId: 'v1',
    invoiceTotal: 1000,
    invoiceLines: [],
    po: { id: 'po1', vendorId: 'v1', totalAmount: 1000, lines: [] },
    gr: { purchaseOrderId: 'po1' },
    ...overrides,
  };
}

describe('InvoiceMatchingService.performThreeWayMatch — header-level fallback (no resolved product lines)', () => {
  let service: InvoiceMatchingService;

  beforeEach(() => {
    service = new InvoiceMatchingService();
  });

  it('passes when invoice total equals the PO total', () => {
    const result = service.performThreeWayMatch(baseInput());
    expect(result.matched).toBe(true);
    expect(result.mode).toBe('header');
  });

  it('passes at exactly 2% difference (tolerance boundary is inclusive)', () => {
    const result = service.performThreeWayMatch(baseInput({ invoiceTotal: 1020 }));
    expect(result.matched).toBe(true);
  });

  it('fails just above the 2% tolerance', () => {
    const result = service.performThreeWayMatch(baseInput({ invoiceTotal: 1021 }));
    expect(result.matched).toBe(false);
  });

  it('applies the tolerance symmetrically to undercharges', () => {
    const result = service.performThreeWayMatch(baseInput({ invoiceTotal: 979 }));
    expect(result.matched).toBe(false);
  });

  it('fails when the invoice vendor differs from the PO vendor', () => {
    const result = service.performThreeWayMatch(baseInput({ invoiceVendorId: 'v2' }));
    expect(result.matched).toBe(false);
  });

  it('fails when the goods receipt belongs to a different PO', () => {
    const result = service.performThreeWayMatch(baseInput({ gr: { purchaseOrderId: 'other-po' } }));
    expect(result.matched).toBe(false);
  });

  it('fails when the PO document is missing', () => {
    const result = service.performThreeWayMatch(baseInput({ po: null }));
    expect(result.matched).toBe(false);
  });

  it('fails when the GR document is missing', () => {
    const result = service.performThreeWayMatch(baseInput({ gr: null }));
    expect(result.matched).toBe(false);
  });

  it('never auto-approves against a zero-total PO', () => {
    const result = service.performThreeWayMatch(
      baseInput({ invoiceTotal: 0, po: { id: 'po1', vendorId: 'v1', totalAmount: 0, lines: [] } }),
    );
    expect(result.matched).toBe(false);
  });

  it('falls back to header-level when some (not all) invoice lines have a resolved product', () => {
    // Mixed OCR line (no productId) alongside a resolved one — safer to fall
    // back to the coarser total-vs-total check than to only check the one
    // resolvable line and ignore the other.
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceLines: [
          { productId: 'p1', quantity: 5, unitPrice: 100 },
          { productId: null, quantity: 5, unitPrice: 100 },
        ],
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 1000,
          lines: [{ productId: 'p1', quantity: 5, unitPrice: 100, receivedQuantity: 5 }],
        },
      }),
    );
    expect(result.mode).toBe('header');
    expect(result.matched).toBe(true);
  });
});

describe('InvoiceMatchingService.performThreeWayMatch — line-level (every invoice line resolved to a product)', () => {
  let service: InvoiceMatchingService;

  beforeEach(() => {
    service = new InvoiceMatchingService();
  });

  it('passes when every line quantity matches what was received and price matches the PO', () => {
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceLines: [{ productId: 'p1', quantity: 10, unitPrice: 50 }],
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 500,
          lines: [{ productId: 'p1', quantity: 10, unitPrice: 50, receivedQuantity: 10 }],
        },
      }),
    );
    expect(result).toEqual({ matched: true, mode: 'line' });
  });

  it('passes for a partial receipt when invoicing exactly what was received (not the full ordered qty)', () => {
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceLines: [{ productId: 'p1', quantity: 6, unitPrice: 50 }],
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 500,
          // ordered 10, only 6 received so far (partial goods receipt)
          lines: [{ productId: 'p1', quantity: 10, unitPrice: 50, receivedQuantity: 6 }],
        },
      }),
    );
    expect(result).toEqual({ matched: true, mode: 'line' });
  });

  it('fails when the invoiced quantity exceeds what was actually received', () => {
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceLines: [{ productId: 'p1', quantity: 10, unitPrice: 50 }],
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 500,
          // trying to invoice for all 10 ordered, but only 6 have arrived
          lines: [{ productId: 'p1', quantity: 10, unitPrice: 50, receivedQuantity: 6 }],
        },
      }),
    );
    expect(result.matched).toBe(false);
    expect(result.mode).toBe('line');
    expect(result.reason).toMatch(/exceeds received quantity/);
  });

  it('fails when a line unit price exceeds the 2% tolerance vs the PO line', () => {
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceLines: [{ productId: 'p1', quantity: 10, unitPrice: 60 }], // 20% over
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 500,
          lines: [{ productId: 'p1', quantity: 10, unitPrice: 50, receivedQuantity: 10 }],
        },
      }),
    );
    expect(result.matched).toBe(false);
    expect(result.mode).toBe('line');
    expect(result.reason).toMatch(/Unit price/);
  });

  it('fails when an invoice line references a product with no matching PO line', () => {
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceLines: [{ productId: 'unknown-product', quantity: 10, unitPrice: 50 }],
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 500,
          lines: [{ productId: 'p1', quantity: 10, unitPrice: 50, receivedQuantity: 10 }],
        },
      }),
    );
    expect(result.matched).toBe(false);
    expect(result.mode).toBe('line');
    expect(result.reason).toMatch(/No PO line/);
  });

  it('checks every line independently — one bad line fails the whole invoice', () => {
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceLines: [
          { productId: 'p1', quantity: 5, unitPrice: 50 }, // fine
          { productId: 'p2', quantity: 100, unitPrice: 20 }, // over-invoiced
        ],
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 1000,
          lines: [
            { productId: 'p1', quantity: 5, unitPrice: 50, receivedQuantity: 5 },
            { productId: 'p2', quantity: 100, unitPrice: 20, receivedQuantity: 40 },
          ],
        },
      }),
    );
    expect(result.matched).toBe(false);
    expect(result.mode).toBe('line');
  });

  it('still rejects a vendor mismatch even when all lines resolve to products', () => {
    const result = service.performThreeWayMatch(
      baseInput({
        invoiceVendorId: 'v2',
        invoiceLines: [{ productId: 'p1', quantity: 10, unitPrice: 50 }],
        po: {
          id: 'po1',
          vendorId: 'v1',
          totalAmount: 500,
          lines: [{ productId: 'p1', quantity: 10, unitPrice: 50, receivedQuantity: 10 }],
        },
      }),
    );
    expect(result.matched).toBe(false);
  });
});
