import { Module } from '@nestjs/common';
import { ForecastController } from './forecast.controller';
import { ForecastClientService } from './forecast.service';

@Module({
  controllers: [ForecastController],
  providers: [ForecastClientService],
  exports: [ForecastClientService],
})
export class ForecastModule {}
