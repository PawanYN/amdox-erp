import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BiController } from './bi.controller';
import { BiService } from './bi.service';
import { BiDataService } from './bi-data.service';
import { BiReportService } from './bi-report.service';
import { BiReportScheduler } from './bi-report.scheduler';
import { EmailChannel } from '../notification/channels/email.channel';

@Module({
  imports: [AuthModule],
  controllers: [BiController],
  providers: [BiService, BiDataService, BiReportService, BiReportScheduler, EmailChannel],
  exports: [BiService, BiDataService],
})
export class BiModule {}
