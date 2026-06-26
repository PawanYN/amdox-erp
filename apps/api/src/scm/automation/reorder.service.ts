/**
 * ============================================================================
 * SERVICE: reorder.service.ts
 * ============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This service powers the "Reorder Automation" feature. It scans through 
 * the inventory and automatically drafts Purchase Orders when stock gets too low.
 * 
 * HOW IT IS IMPLEMENTED:
 * - `runReorderChecks()`: This function fetches all active `ReorderRules`.
 * - For each rule, it mathematically sums up the `StockLevel.quantity` across 
 *   ALL physical warehouses to get a `totalStock` integer.
 * - If `totalStock < thresholdQty`, it checks if the product has a `defaultVendorId`.
 * - Next, it queries the database to ensure we don't already have an active DRAFT 
 *   or SUBMITTED PO out for this exact product (preventing duplicate auto-orders).
 * - If no active PO exists, it dynamically creates a new DRAFT Purchase Order 
 *   for the `reorderQty` amount, assigned to the default vendor.
 * 
 * RELEVANT CONTEXT FOR NEW DEVS:
 * In a fully production-ready system, this `runReorderChecks()` function 
 * would typically be attached to a Cron Job (via `@nestjs/schedule`) to run 
 * every night at midnight. Currently, it is exposed as a REST endpoint 
 * (`/scm/automation/run-reorder`) so that it can be triggered on demand by 
 * an external scheduler or button click.
 * ============================================================================
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';

@Injectable()
export class ReorderAutomationService {
  private prisma = new PrismaClient();
  private readonly logger = new Logger(ReorderAutomationService.name);

  async runReorderChecks(tenantId: string) {
    this.logger.log(`Running reorder automation for tenant: ${tenantId}`);

    // Find all active reorder rules
    const rules = await this.prisma.reorderRule.findMany({
      where: { tenantId, isActive: true },
      include: { product: { include: { stockLevels: true } } },
    });

    let draftOrdersCreated = 0;

    for (const rule of rules) {
      // Calculate total stock across all warehouses
      const totalStock = rule.product.stockLevels.reduce((sum, level) => sum + Number(level.quantity), 0);

      if (totalStock < Number(rule.thresholdQty)) {
        // Needs reorder
        if (!rule.product.defaultVendorId) {
          this.logger.warn(`Cannot reorder SKU ${rule.product.sku}: No defaultVendorId set.`);
          continue;
        }

        // Check if an active DRAFT or SUBMITTED PO already exists for this product to avoid duplicates
        const existingPo = await this.prisma.purchaseOrder.findFirst({
          where: {
            tenantId,
            vendorId: rule.product.defaultVendorId,
            status: { in: ['DRAFT', 'SUBMITTED'] },
            lines: { some: { productId: rule.productId } },
          },
        });

        if (!existingPo) {
          const poNumber = `AUTO-PO-${Date.now()}`;
          await this.prisma.purchaseOrder.create({
            data: {
              tenantId,
              poNumber,
              vendorId: rule.product.defaultVendorId,
              status: 'DRAFT',
              totalAmount: Number(rule.product.unitCost) * Number(rule.reorderQty),
              lines: {
                create: {
                  tenantId,
                  productId: rule.productId,
                  quantity: rule.reorderQty,
                  unitPrice: rule.product.unitCost,
                },
              },
            },
          });
          
          this.logger.log(`Created auto PO ${poNumber} for product ${rule.product.sku}`);
          draftOrdersCreated++;
        }
      }
    }

    return { success: true, draftOrdersCreated };
  }
}
