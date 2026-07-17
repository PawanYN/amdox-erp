import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../infrastructure/search/search.module';
import { ApController } from './ap/ap.controller';
import { ApService } from './ap/ap.service';
import { InvoiceMatchingService } from './ap/invoice-matching.service';
import { OcrService } from './ap/ocr.service';
import { ArController } from './ar/ar.controller';
import { ArService } from './ar/ar.service';
import { SalesOrderController } from './sales/sales-order.controller';
import { SalesOrderService } from './sales/sales-order.service';
import { JournalEntryController } from './gl/journal-entry.controller';
import { JournalEntryService } from './gl/journal-entry.service';
import { FxRateService } from './fx/fx-rate.service';
import { OutboxProcessor } from './automation/outbox.processor';

import { PmCostBridgeListener } from './listeners/pm-cost-bridge.listener';
import { ScmFinanceBridgeListener } from './listeners/scm-finance-bridge.listener';
import { QUEUE_NAMES } from '../infrastructure/queues/queue-names';

@Module({
  imports: [
    AuthModule,
    SearchModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.FINANCE_OUTBOX,
    }),
  ],
  controllers: [ApController, ArController, SalesOrderController, JournalEntryController],
  providers: [
    ApService,
    InvoiceMatchingService,
    OcrService,
    ArService,
    SalesOrderService,
    JournalEntryService,
    FxRateService,
    OutboxProcessor,
    PmCostBridgeListener,
    ScmFinanceBridgeListener,
  ],
  exports: [FxRateService, ApService],
})
export class FinanceModule {}
