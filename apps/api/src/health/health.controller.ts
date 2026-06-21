import { Controller, Get, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  async getLive(@Res() res: Response) {
    const result = await this.healthService.checkLiveness();
    return res.status(HttpStatus.OK).json(result);
  }

  @Get('ready')
  async getReady(@Res() res: Response) {
    const result = await this.healthService.checkReadiness();
    if (result.status === 'ready') {
      return res.status(HttpStatus.OK).json(result);
    } else {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json(result);
    }
  }
}
