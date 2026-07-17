import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { ForecastController } from './forecast.controller';
import { ForecastClientService } from './forecast.service';
import { ForecastRetrainScheduler, ForecastRetrainProcessor } from './forecast-retrain.processor';
import { QUEUE_NAMES } from '../infrastructure/queues/queue-names';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.FORECAST_RETRAIN,
    }),
  ],
  controllers: [ForecastController],
  providers: [ForecastClientService, ForecastRetrainScheduler, ForecastRetrainProcessor],
  exports: [ForecastClientService],
})
export class ForecastModule {}
