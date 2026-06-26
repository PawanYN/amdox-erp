import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaClient } from '@amdox/db';

/**
 * BullMQ Processor for the Finance Outbox.
 * 
 * WHAT: Listens for events placed into the `OutboxEvent` table and processes them.
 * WHY: The Outbox pattern guarantees at-least-once delivery of domain events 
 * (like invoice.approved) even if the application crashes immediately after DB commit.
 */
@Processor('finance-outbox')
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);
  private prisma = new PrismaClient();

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing outbox job ${job.id} for event ${job.data.eventType}`);
    
    // In a real implementation, this job might just be a trigger to poll the DB,
    // or the job data contains the actual outbox event ID.
    // Assuming job.data contains the OutboxEvent ID:
    const outboxEventId = job.data.id;

    if (!outboxEventId) {
       this.logger.warn('Job missing outbox event ID in payload.');
       return;
    }

    const event = await this.prisma.outboxEvent.findUnique({
      where: { id: outboxEventId }
    });

    if (!event || event.status !== 'PENDING') {
      this.logger.log(`Outbox event ${outboxEventId} is already processed or missing.`);
      return;
    }

    try {
      // Execute side-effects here (e.g. calling a remote Audit or Notification service)
      this.logger.log(`Executing side-effects for ${event.eventType}... Payload: ${JSON.stringify(event.payload)}`);
      
      // Simulate external API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mark as processed
      await this.prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          attempts: event.attempts + 1
        }
      });

      this.logger.log(`Successfully processed outbox event ${outboxEventId}`);
    } catch (error: any) {
      this.logger.error(`Failed to process outbox event ${outboxEventId}: ${error.message}`);
      
      // Mark as failed and increment attempts
      await this.prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: {
          status: 'FAILED',
          attempts: event.attempts + 1
        }
      });
      throw error; // Let BullMQ handle retries
    }
  }
}
