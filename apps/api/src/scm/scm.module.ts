/**
 * MODULE: scm.module.ts
 *
 * This file bundles together all the controllers and services for this specific feature.
 * It acts as the "glue" that tells NestJS how these files depend on each other.
 *
 * Vendor, product, inventory, purchase, automation, and requisition are registered
 * directly here rather than each having their own `.module.ts` — there's nothing
 * about them that needs isolating. `VendorPortalModule` is the one real exception:
 * it's imported as its own module because it has its own external-facing auth guard
 * (`vendor-portal.guard.ts`) for non-employee vendor users, a genuinely separate
 * concern from the rest of SCM.
 */
import { Module } from '@nestjs/common';
import { VendorController } from './vendor/vendor.controller';
import { VendorService } from './vendor/vendor.service';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { PurchaseController } from './purchase/purchase.controller';
import { PurchaseService } from './purchase/purchase.service';
import { ReorderController } from './automation/reorder.controller';
import { ReorderAutomationService } from './automation/reorder.service';
import { RequisitionController } from './requisition/requisition.controller';
import { RequisitionService } from './requisition/requisition.service';
import { RequisitionListener } from './requisition/requisition.listener';
import { VendorPortalModule } from './vendor-portal/vendor-portal.module';
import { NotificationModule } from '../notification/notification.module';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../infrastructure/search/search.module';

@Module({
  imports: [AuthModule, VendorPortalModule, NotificationModule, SearchModule],
  controllers: [
    VendorController,
    ProductController,
    InventoryController,
    PurchaseController,
    ReorderController,
    RequisitionController,
  ],
  providers: [
    VendorService,
    ProductService,
    InventoryService,
    PurchaseService,
    ReorderAutomationService,
    RequisitionService,
    RequisitionListener,
  ],
})
export class ScmModule {}
