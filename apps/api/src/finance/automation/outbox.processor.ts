import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import { prisma } from '@amdox/db';
import { QUEUE_NAMES } from '../../infrastructure/queues/queue-names';

/**
 * Maps each outbox eventType to the same {action, entityType, entityId} that
 * AuditEventListener records for that event (see audit-event.listener.ts) — this
 * lets the processor tell whether the synchronous EventEmitter2 path already
 * delivered the event before it gets here.
 */
const AUDIT_ACTION_MAP: Record<
  string,
  { action: string; entityType: string; entityIdKey: string }
> = {
  'invoice.approved': {
    action: 'INVOICE_APPROVED',
    entityType: 'Invoice',
    entityIdKey: 'invoiceId',
  },
  'invoice.issued': {
    action: 'AR_INVOICE_ISSUED',
    entityType: 'Invoice',
    entityIdKey: 'invoiceId',
  },
  'payment.made': { action: 'PAYMENT_MADE', entityType: 'Payment', entityIdKey: 'paymentId' },
  'payment.received': {
    action: 'PAYMENT_RECEIVED',
    entityType: 'Payment',
    entityIdKey: 'paymentId',
  },
};

/**
 * BullMQ Processor for the Finance Outbox.
 *
 * WHAT: Listens for events placed into the `OutboxEvent` table and processes them.
 * WHY: The Outbox pattern guarantees at-least-once delivery of domain events
 * (like invoice.approved) even if the application crashes immediately after DB commit.
 *
 * The services that write these rows (ap/ar/sales-order) also emit the domain event
 * directly and synchronously in the same call, so in the normal case Audit/Notification
 * have already handled it by the time this job runs. This processor checks for that via
 * the audit log before doing anything — if the sync path already delivered it, this is
 * just bookkeeping (mark PROCESSED); if not (the app crashed between the DB commit and
 * the sync emit), this re-emits the event for real, which is the actual crash-safety
 * guarantee the Outbox pattern exists for.
 */
@Processor(QUEUE_NAMES.FINANCE_OUTBOX)
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(private readonly eventEmitter: EventEmitter2) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing outbox job ${job.id} for event ${job.data.eventType}`);

    const outboxEventId = job.data.id;

    if (!outboxEventId) {
      this.logger.warn('Job missing outbox event ID in payload.');
      return;
    }

    // tenant-scope-ok: system-wide background worker processing any tenant's queued
    // outbox events by design (outboxEventId is our own internal job payload, not
    // attacker-facing HTTP input) — tenantId isn't known until this fetch returns it.
    const event = await prisma.outboxEvent.findUnique({
      where: { id: outboxEventId },
    });

    if (!event || event.status !== 'PENDING') {
      this.logger.log(`Outbox event ${outboxEventId} is already processed or missing.`);
      return;
    }

    try {
      const mapping = AUDIT_ACTION_MAP[event.eventType];
      const payload = event.payload as Record<string, unknown> | null;
      const entityId =
        mapping && payload ? (payload[mapping.entityIdKey] as string | undefined) : undefined;

      let alreadyHandled = false;
      if (mapping && entityId) {
        // tenant-scope-ok: filtered by this outbox event's own tenantId below.
        const existingAuditEntry = await prisma.auditLog.findFirst({
          where: {
            tenantId: event.tenantId,
            action: mapping.action,
            entityType: mapping.entityType,
            entityId,
          },
        });
        alreadyHandled = !!existingAuditEntry;
      }

      if (alreadyHandled) {
        this.logger.log(
          `Outbox event ${outboxEventId} (${event.eventType}) already delivered via the synchronous path — marking processed, no re-emit.`,
        );
      } else {
        this.logger.log(
          `Outbox event ${outboxEventId} (${event.eventType}) not yet delivered — re-emitting for crash-recovery delivery. Payload: ${JSON.stringify(event.payload)}`,
        );
        this.eventEmitter.emit(event.eventType, event.payload);
      }

      // tenant-scope-ok: same event record just fetched (and status-verified) above.
      // Mark as processed
      await prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          attempts: event.attempts + 1,
        },
      });

      this.logger.log(`Successfully processed outbox event ${outboxEventId}`);
    } catch (error: any) {
      this.logger.error(`Failed to process outbox event ${outboxEventId}: ${error.message}`);

      // tenant-scope-ok: same event record fetched (and status-verified) above.
      // Mark as failed and increment attempts
      await prisma.outboxEvent.update({
        where: { id: outboxEventId },
        data: {
          status: 'FAILED',
          attempts: event.attempts + 1,
        },
      });
      throw error; // Let BullMQ handle retries
    }
  }
}
