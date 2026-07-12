/**
 * SMS channel — dispatches via HTTP webhook (Twilio-compatible env vars) or
 * logs in dev when no provider is configured.
 */
import { Injectable, Logger } from '@nestjs/common';

export interface SmsPayload {
  to: string;
  body: string;
}

@Injectable()
export class SmsChannel {
  private readonly logger = new Logger(SmsChannel.name);
  private readonly webhookUrl = process.env.SMS_WEBHOOK_URL;
  private readonly apiKey = process.env.SMS_API_KEY;

  async send(payload: SmsPayload): Promise<{ delivered: boolean; channel: string; to: string }> {
    if (!this.webhookUrl) {
      this.logger.log(`[SMS] dev-stub to=${payload.to} body="${payload.body.slice(0, 80)}"`);
      return { delivered: true, channel: 'SMS', to: payload.to };
    }

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ to: payload.to, message: payload.body }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        this.logger.error(`[SMS] provider returned ${res.status}`);
        return { delivered: false, channel: 'SMS', to: payload.to };
      }
      this.logger.log(`[SMS] sent to=${payload.to}`);
      return { delivered: true, channel: 'SMS', to: payload.to };
    } catch (err) {
      this.logger.error(`[SMS] failed to=${payload.to}: ${(err as Error).message}`);
      return { delivered: false, channel: 'SMS', to: payload.to };
    }
  }
}
