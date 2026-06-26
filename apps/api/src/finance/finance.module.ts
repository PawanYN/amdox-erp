import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ApController } from './ap/ap.controller';
import { ApService } from './ap/ap.service';
import { InvoiceMatchingService } from './ap/invoice-matching.service';
import { OcrService } from './ap/ocr.service';
import { ArController } from './ar/ar.controller';
import { ArService } from './ar/ar.service';
import { GlController } from './gl/gl.controller';
import { GlService } from './gl/gl.service';
import { FxRateService } from './fx/fx-rate.service';
import { OutboxProcessor } from './automation/outbox.processor';

/**
 * MODULE: finance.module.ts
 * 
 * This file bundles together all the controllers and services for this specific feature.
 * It acts as the "glue" that tells NestJS how these files depend on each other.
 */
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'finance-outbox',
    }),
  ],
  controllers: [
    ApController,
    ArController,
    GlController
  ],
  providers: [
    ApService,
    InvoiceMatchingService,
    OcrService,
    ArService,
    GlService,
    FxRateService,
    OutboxProcessor
  ],
  exports: [
    FxRateService // In case other modules need currency conversions
  ]
})
export class FinanceModule {}
