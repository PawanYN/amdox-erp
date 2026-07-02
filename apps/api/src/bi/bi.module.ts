import { Module } from '@nestjs/common';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';
import { BiDataService } from './bi-data.service';
import { BiReportService } from './bi-report.service';
import { BiReportScheduler } from './bi-report.scheduler';
import { EmailChannel } from '../notification/channels/email.channel';

@Module({
  controllers: [BiController],
  providers: [
    BiService,
    BiDataService,
    BiReportService,
    BiReportScheduler,
    EmailChannel,
  ],
  exports: [BiService, BiDataService],
})
export class BiModule {}
