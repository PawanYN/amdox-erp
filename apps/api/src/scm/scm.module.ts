/**
 * MODULE: scm.module.ts
 * 
 * This file bundles together all the controllers and services for this specific feature.
 * It acts as the "glue" that tells NestJS how these files depend on each other.
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

@Module({
  controllers: [
    VendorController,
    ProductController,
    InventoryController,
    PurchaseController,
    ReorderController,
  ],
  providers: [
    VendorService,
    ProductService,
    InventoryService,
    PurchaseService,
    ReorderAutomationService,
  ],
})
export class ScmModule {}
