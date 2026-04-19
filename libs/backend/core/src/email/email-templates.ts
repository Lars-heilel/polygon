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
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Подтверждение аккаунта</h2>
          <p>Нажмите на кнопку ниже, чтобы подтвердить ваш email-адрес.</p>
          <p>
            <a href="${link}"
               style="display: inline-block; padding: 12px 24px; background: #6366f1;
                      color: #fff; text-decoration: none; border-radius: 6px;">
              Подтвердить аккаунт
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">
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
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Сброс пароля</h2>
          <p>Вы запросили сброс пароля. Нажмите на кнопку ниже.</p>
          <p>
            <a href="${link}"
               style="display: inline-block; padding: 12px 24px; background: #6366f1;
                      color: #fff; text-decoration: none; border-radius: 6px;">
              Сбросить пароль
            </a>
          </p>
          <p style="color: #6b7280; font-size: 13px;">
            Ссылка действительна 1 час. Если вы не запрашивали сброс пароля — проигнорируйте это письмо.
          </p>
        </div>
      `,
    };
  },
};
