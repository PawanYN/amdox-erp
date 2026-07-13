import { Injectable, Logger } from '@nestjs/common';

export interface ThreeWayMatchPoLine {
  productId: string;
  quantity: number;
  unitPrice: number;
  receivedQuantity: number;
}

export interface ThreeWayMatchInvoiceLine {
  productId?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface ThreeWayMatchInput {
  invoiceVendorId?: string | null;
  invoiceTotal: number;
  invoiceLines: ThreeWayMatchInvoiceLine[];
  po: { id: string; vendorId: string; totalAmount: number; lines: ThreeWayMatchPoLine[] } | null;
  gr: { purchaseOrderId: string } | null;
}

export interface ThreeWayMatchResult {
  matched: boolean;
  /** 'line' when every invoice line resolved to a product and was checked
   *  individually; 'header' when falling back to comparing grand totals
   *  (OCR lines with no resolved product, or no lines at all). */
  mode: 'line' | 'header';
  reason?: string;
}

const TOLERANCE_PERCENT = 0.02; // 2%

/**
 * Service to handle the 3-Way Matching of an Invoice against a Purchase Order and Goods Receipt.
 *
 * WHAT: This service validates that an AP invoice matches the original PO and the actual GR.
 * WHY: This is a core financial control (3-Way Match) to prevent paying for goods that were not
 * ordered, not received, or overcharged. It satisfies F-03 AP Automation requirements.
 *
 * Takes already-loaded documents rather than re-fetching by ID for two reasons: it's callable
 * from inside an open `prisma.$transaction` (a separate fetch via the global client wouldn't see
 * an invoice created earlier in that same uncommitted transaction), and it makes the matching
 * logic itself a pure, easily-tested function with no database dependency.
 */
@Injectable()
export class InvoiceMatchingService {
  private readonly logger = new Logger(InvoiceMatchingService.name);

  /**
   * Line-level when possible: each invoice line with a resolved productId is checked
   * against that product's PO line — invoiced quantity must not exceed what's actually
   * been received, and unit price must be within tolerance of the PO's price. Falls back
   * to comparing grand totals (the original, simpler check) when any line's product
   * couldn't be resolved (typical of OCR extraction) or there are no lines at all.
   */
  performThreeWayMatch(input: ThreeWayMatchInput): ThreeWayMatchResult {
    const { po, gr, invoiceVendorId, invoiceTotal, invoiceLines } = input;

    if (!po || !gr) {
      this.logger.warn('3-way match failed: missing PO or GR document');
      return { matched: false, mode: 'header', reason: 'Missing PO or GR document' };
    }

    if (po.vendorId !== invoiceVendorId) {
      this.logger.warn('3-way match failed: vendor mismatch between PO and Invoice');
      return { matched: false, mode: 'header', reason: 'Vendor mismatch between PO and Invoice' };
    }

    if (gr.purchaseOrderId !== po.id) {
      this.logger.warn('3-way match failed: Goods Receipt does not belong to PO');
      return { matched: false, mode: 'header', reason: 'Goods Receipt does not belong to PO' };
    }

    const everyLineHasProduct = invoiceLines.length > 0 && invoiceLines.every((l) => l.productId);

    if (everyLineHasProduct) {
      for (const invLine of invoiceLines) {
        const poLine = po.lines.find((l) => l.productId === invLine.productId);
        if (!poLine) {
          this.logger.warn(`3-way match failed: no PO line for product ${invLine.productId}`);
          return {
            matched: false,
            mode: 'line',
            reason: `No PO line found for product ${invLine.productId}`,
          };
        }

        if (invLine.quantity > poLine.receivedQuantity + 1e-6) {
          this.logger.warn(
            `3-way match failed: invoiced qty ${invLine.quantity} exceeds received qty ${poLine.receivedQuantity} for product ${invLine.productId}`,
          );
          return {
            matched: false,
            mode: 'line',
            reason: `Invoiced quantity (${invLine.quantity}) exceeds received quantity (${poLine.receivedQuantity})`,
          };
        }

        if (poLine.unitPrice === 0) {
          return { matched: false, mode: 'line', reason: 'PO line has a zero unit price' };
        }
        const priceDiff = Math.abs(invLine.unitPrice - poLine.unitPrice) / poLine.unitPrice;
        if (priceDiff > TOLERANCE_PERCENT) {
          this.logger.warn(
            `3-way match failed: unit price difference ${(priceDiff * 100).toFixed(2)}% exceeds tolerance for product ${invLine.productId}`,
          );
          return {
            matched: false,
            mode: 'line',
            reason: `Unit price difference ${(priceDiff * 100).toFixed(2)}% exceeds ${TOLERANCE_PERCENT * 100}% tolerance`,
          };
        }
      }

      this.logger.log('3-way match successful (line-level)');
      return { matched: true, mode: 'line' };
    }

    // Header-level fallback: total amount within tolerance of the PO total,
    // assuming full receipt — the original, coarser check.
    const poTotal = po.totalAmount || 0;
    if (poTotal === 0) {
      return { matched: false, mode: 'header', reason: 'PO total is zero' };
    }
    const diff = Math.abs(invoiceTotal - poTotal) / poTotal;
    if (diff <= TOLERANCE_PERCENT) {
      this.logger.log(`3-way match successful (header-level)! Difference ${diff * 100}%`);
      return { matched: true, mode: 'header' };
    }
    this.logger.warn(`3-way match failed: amount difference ${diff * 100}% exceeds tolerance`);
    return {
      matched: false,
      mode: 'header',
      reason: `Amount difference ${(diff * 100).toFixed(2)}% exceeds ${TOLERANCE_PERCENT * 100}% tolerance`,
    };
  }
}
