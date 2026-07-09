/**
 * Email channel — real SMTP delivery via Nodemailer (free/OSS, no paid
 * provider required — see docs/Amdox_Free_Alternatives.pdf, which flags
 * AWS SES as paid/restricted and Nodemailer as a free alternative).
 *
 * In dev/kind, SMTP_* env vars point at Mailpit (docker-compose service
 * `mailpit`) — a fake SMTP server that actually receives real SMTP
 * traffic and shows it in a web UI at http://localhost:8025, so delivery
 * can be verified end-to-end with no external mail account or
 * credentials. Production just points SMTP_HOST/PORT/USER/PASS at a real
 * provider (Gmail SMTP, a transactional-email service, Postal, etc.) —
 * no code changes needed.
 */
import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor() {
    this.from = process.env.SMTP_FROM || 'Amdox ERP <no-reply@amdox.local>';
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 1025,
      secure: process.env.SMTP_SECURE === 'true',
      // Mailpit (and most local catchers) accept unauthenticated SMTP;
      // only pass auth when real credentials are actually configured.
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
  }

  async send(payload: EmailPayload) {
    const attachments = payload.attachmentPath
      ? [
          {
            filename: payload.attachmentPath.split('/').pop() || 'attachment',
            content: fs.readFileSync(payload.attachmentPath),
          },
        ]
      : undefined;

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        attachments,
      });
      this.logger.log(
        `[EMAIL] sent to=${payload.to} subject="${payload.subject}" messageId=${info.messageId}`,
      );
      return { delivered: true, channel: 'EMAIL', to: payload.to, messageId: info.messageId };
    } catch (err) {
      this.logger.error(`[EMAIL] failed to=${payload.to}: ${(err as Error).message}`);
      return { delivered: false, channel: 'EMAIL', to: payload.to };
    }
  }
}
