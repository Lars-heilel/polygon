import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { EMAIL_PROVIDER, type Env, type IEmailProvider, emailTemplates } from '@org/core';
import type { Counter } from 'prom-client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: IEmailProvider,
    private readonly config: ConfigService<Env>,
    @InjectMetric('email_sent_total') private readonly emailCounter: Counter<string>,
  ) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.verification(
      token,
      this.config.getOrThrow('APP_URL', { infer: true }),
    );
    try {
      await this.email.send({ to, subject, html });
      this.emailCounter.inc({ type: 'verification', status: 'success' });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (err) {
      this.emailCounter.inc({ type: 'verification', status: 'error' });
      this.logger.error(
        `Failed to send verification email to ${to}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.passwordReset(
      token,
      this.config.getOrThrow('APP_URL', { infer: true }),
    );
    try {
      await this.email.send({ to, subject, html });
      this.emailCounter.inc({ type: 'password_reset', status: 'success' });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      this.emailCounter.inc({ type: 'password_reset', status: 'error' });
      this.logger.error(
        `Failed to send password reset email to ${to}`,
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
