import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EMAIL_PROVIDER,
  emailTemplates,
  type Env,
  type IEmailProvider,
} from '@org/core';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: IEmailProvider,
    private readonly config: ConfigService<Env>
  ) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.verification(
      token,
      this.config.get('APP_URL', { infer: true })!
    );
    await this.email.send({ to, subject, html });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.passwordReset(
      token,
      this.config.get('APP_URL', { infer: true })!
    );
    await this.email.send({ to, subject, html });
  }
}
