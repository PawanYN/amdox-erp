import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { prisma } from '@amdox/db';
import { AmdoxLogger } from '../common/logger/amdox-logger';
import { ForecastClientService } from './forecast.service';

const WEEKLY_RETRAIN_JOB_ID = 'forecast-weekly-retrain';
const WEEKLY_CRON_PATTERN = '0 0 * * 0'; // every Sunday at midnight

/**
 * WHAT: Schedules a recurring BullMQ job (Redis-backed cron) that retrains every
 * tenant's demand forecasts weekly.
 * WHY: Predictions previously only ever refreshed when a user clicked "Train" on
 * a single SKU — nothing kept them current automatically (PDF Day 15-16 spec).
 */
@Injectable()
export class ForecastRetrainScheduler implements OnModuleInit {
  private readonly logger = new Logger(ForecastRetrainScheduler.name);

  constructor(@InjectQueue('forecast-retrain') private readonly queue: Queue) {}

  async onModuleInit() {
    // Stable jobId + identical repeat options make this idempotent across restarts —
    // BullMQ won't create a duplicate repeatable schedule for the same key.
    await this.queue.add(
      'weekly-retrain',
      {},
      {
        repeat: { pattern: WEEKLY_CRON_PATTERN },
        jobId: WEEKLY_RETRAIN_JOB_ID,
      },
    );
    this.logger.log(`Scheduled weekly forecast retrain (cron: ${WEEKLY_CRON_PATTERN})`);
  }
}

@Processor('forecast-retrain')
export class ForecastRetrainProcessor extends WorkerHost {
  private readonly logger = new Logger(ForecastRetrainProcessor.name);
  constructor(private readonly forecastService: ForecastClientService) {
    super();
  }

  async process(_job: Job): Promise<void> {
    const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });

    for (const tenant of tenants) {
      try {
        const result = await this.forecastService.retrainAllProducts(tenant.id);
        AmdoxLogger.event(
          'Weekly forecast retrain complete',
          `tenant=${tenant.slug}  succeeded=${result.succeeded}  failed=${result.failed}/${result.totalProducts}`,
        );
      } catch (error) {
        this.logger.error(
          `Weekly retrain failed entirely for tenant ${tenant.slug}: ${(error as Error).message}`,
        );
      }
    }
  }
}
