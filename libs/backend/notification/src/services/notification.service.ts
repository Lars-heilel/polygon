import { Inject, Injectable } from '@nestjs/common';
import { ConfigService, EMAIL_PROVIDER, emailTemplates, type IEmailProvider } from '@org/core';

@Injectable()
export class NotificationService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly email: IEmailProvider,
    private readonly config: ConfigService,
  ) {}

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.verification(token, this.config.appUrl);
    await this.email.send({ to, subject, html });
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const { subject, html } = emailTemplates.passwordReset(token, this.config.appUrl);
    await this.email.send({ to, subject, html });
  }
}
