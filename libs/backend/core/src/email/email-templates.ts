interface EmailTemplate {
  subject: string;
  html: string;
}

export const emailTemplates = {
  verification(token: string, clientUrl: string): EmailTemplate {
    const link = `${clientUrl}/api/auth/verify-email?token=${token}`;
    return {
      subject: 'Подтвердите ваш аккаунт в Polygon',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border-top: 4px solid #4f46e5; border-radius: 8px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Добро пожаловать в Polygon</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Нажмите на кнопку ниже, чтобы подтвердить ваш email-адрес.
          </p>
          <p style="margin: 24px 0;">
            <a href="${link}"
               style="display: inline-block; padding: 12px 24px; background: #4f46e5;
                      color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Подтвердить аккаунт
            </a>
          </p>
          <p style="color: #94a3b8; font-size: 13px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Ссылка действительна 24 часа. Если вы не регистрировались — просто проигнорируйте это письмо.
          </p>
        </div>
      `,
    };
  },

  passwordReset(token: string, appUrl: string): EmailTemplate {
    const link = `${appUrl}/reset-password?token=${token}`;
    return {
      subject: 'Сброс пароля в Polygon',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border-top: 4px solid #dc2626; border-radius: 8px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Сброс пароля</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            Вы запросили сброс пароля. Нажмите на кнопку ниже, чтобы задать новый.
          </p>
          <div style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 10px 12px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; color: #92400e; font-size: 13px;">
              Ссылка действительна всего <strong>1 час</strong>.
            </p>
          </div>
          <p style="margin: 24px 0;">
            <a href="${link}"
               style="display: inline-block; padding: 12px 24px; background: #0f172a;
                      color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Сбросить пароль
            </a>
          </p>
          <p style="color: #94a3b8; font-size: 13px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
            Если вы не запрашивали сброс — проигнорируйте письмо или смените пароль вручную.
          </p>
        </div>
      `,
    };
  },
};