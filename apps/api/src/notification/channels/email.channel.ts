/**
 * Email channel for scheduled BI report delivery (PDF/Excel attachments).
 * Uses structured logging as delivery stub until AWS SES is wired (BE-07).
 */
import { Injectable, Logger } from '@nestjs/common';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);

  async send(payload: EmailPayload) {
    const isDev = process.env.NODE_ENV !== 'production';
    this.logger.log(
      `[EMAIL${isDev ? ' (dev log-only)' : ''}] to=${payload.to} subject="${payload.subject}" attachment=${payload.attachmentPath || 'none'}`,
    );
    if (isDev) {
      this.logger.debug(
        `Dev mode: email not sent externally. Body preview: ${payload.body.slice(0, 120)}…`,
      );
    } else {
      this.logger.debug(payload.body);
    }
    return { delivered: true, channel: 'EMAIL', to: payload.to, devMode: isDev };
  }
}
