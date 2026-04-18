import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import type { Env } from '../config/env.schema';
import type { IEmailPayload, IEmailProvider } from './email.interface';

@Injectable()
export class NodemailerEmailProvider implements IEmailProvider {
  private readonly logger = new Logger(NodemailerEmailProvider.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: ConfigService<Env>) {
    const user = this.config.getOrThrow('SMTP_USER', { infer: true });
    const pass = this.config.getOrThrow('SMTP_PASSWORD', { infer: true });
    const port = this.config.getOrThrow('SMTP_PORT', { infer: true });

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow('SMTP_HOST', { infer: true }),
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  async send(payload: IEmailPayload): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.get('SMTP_FROM', { infer: true }),
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
  }
}
