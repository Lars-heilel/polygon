import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ConfigService } from '../config/config.service';
import type { IEmailPayload, IEmailProvider } from './email.interface';

@Injectable()
export class NodemailerEmailProvider implements IEmailProvider, OnModuleInit {
  private readonly logger = new Logger(NodemailerEmailProvider.name);
  private transporter!: Transporter;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpPort === 465,
      auth:
        this.config.smtpUser && this.config.smtpPassword
          ? { user: this.config.smtpUser, pass: this.config.smtpPassword }
          : undefined,
    });
  }

  async send(payload: IEmailPayload): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.smtpFrom,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
    });
    this.logger.log(`Email sent to ${payload.to}: ${payload.subject}`);
  }
}
