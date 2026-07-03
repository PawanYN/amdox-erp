import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

export interface WebhookPayload {
  eventType: string;
  title: string;
  body?: string;
  tenantId: string;
  userId?: string;
  timestamp: string;
}

/**
 * WEBHOOK CHANNEL
 * Sends HMAC-SHA256 signed HTTP POST requests to a tenant-configured endpoint.
 * Signature is sent in the `X-Amdox-Signature` header so the receiver can verify authenticity.
 */
@Injectable()
export class WebhookChannel {
  private readonly logger = new Logger(WebhookChannel.name);

  async dispatch(webhookUrl: string, signingSecret: string, payload: WebhookPayload): Promise<boolean> {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', signingSecret).update(body).digest('hex');

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amdox-Signature': `sha256=${signature}`,
          'X-Amdox-Tenant': payload.tenantId,
          'User-Agent': 'AmdoxERP-Webhook/1.0',
        },
        body,
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        this.logger.log(`Webhook delivered to ${webhookUrl} [${res.status}] event=${payload.eventType}`);
        return true;
      }

      this.logger.warn(`Webhook delivery failed: ${webhookUrl} returned HTTP ${res.status}`);
      return false;
    } catch (err: any) {
      this.logger.error(`Webhook dispatch error to ${webhookUrl}: ${err?.message}`);
      return false;
    }
  }
}
