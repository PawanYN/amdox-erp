import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ForecastController } from './forecast.controller';
import { ForecastClientService } from './forecast.service';
import { ForecastRetrainScheduler, ForecastRetrainProcessor } from './forecast-retrain.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'forecast-retrain',
    }),
  ],
  controllers: [ForecastController],
  providers: [ForecastClientService, ForecastRetrainScheduler, ForecastRetrainProcessor],
  exports: [ForecastClientService],
})
export class ForecastModule {}
