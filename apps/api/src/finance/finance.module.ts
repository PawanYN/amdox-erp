import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { ApController } from './ap/ap.controller';
import { ApService } from './ap/ap.service';
import { InvoiceMatchingService } from './ap/invoice-matching.service';
import { OcrService } from './ap/ocr.service';
import { ArController } from './ar/ar.controller';
import { ArService } from './ar/ar.service';
import { SalesOrderController } from './sales/sales-order.controller';
import { SalesOrderService } from './sales/sales-order.service';
import { GlController } from './gl/gl.controller';
import { GlService } from './gl/gl.service';
import { FxRateService } from './fx/fx-rate.service';
import { OutboxProcessor } from './automation/outbox.processor';

import { PmCostBridgeListener } from './pm-cost-bridge.listener';
import { ScmFinanceBridgeListener } from './scm-finance-bridge.listener';

@Module({
  imports: [
    AuthModule,
    SearchModule,
    BullModule.registerQueue({
      name: 'finance-outbox',
    }),
  ],
  controllers: [ApController, ArController, SalesOrderController, GlController],
  providers: [
    ApService,
    InvoiceMatchingService,
    OcrService,
    ArService,
    SalesOrderService,
    GlService,
    FxRateService,
    OutboxProcessor,
    PmCostBridgeListener,
    ScmFinanceBridgeListener,
  ],
  exports: [FxRateService, ApService],
})
export class FinanceModule {}
