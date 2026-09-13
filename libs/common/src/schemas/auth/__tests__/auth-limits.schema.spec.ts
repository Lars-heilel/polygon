import { loginSchema } from '../login.schema';
import { oauthLoginSchema } from '../oauth-login.schema';
import { registerSchema } from '../register.schema';
import { resendVerificationSchema } from '../resend-verification.schema';
import { forgotPasswordSchema, resetPasswordSchema } from '../reset-password.schema';

describe('auth contract limits', () => {
  it('caps registration fields', () => {
    expect(
      registerSchema.safeParse({
        email: 'a@example.com',
        password: 'Aa1!aaaa',
        username: 'u'.repeat(33),
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        email: `${'a'.repeat(250)}@ex.com`,
        password: 'Aa1!aaaa',
        username: 'alice',
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        email: 'a@example.com',
        password: `Aa1!${'a'.repeat(125)}`,
        username: 'alice',
      }).success,
    ).toBe(false);
  });

  it('caps login fields', () => {
    expect(
      loginSchema.safeParse({ email: `${'a'.repeat(250)}@ex.com`, password: 'x' }).success,
    ).toBe(false);
    expect(
      loginSchema.safeParse({ email: 'a@example.com', password: 'p'.repeat(129) }).success,
    ).toBe(false);
  });

  it('caps oauth fields', () => {
    expect(
      oauthLoginSchema.safeParse({
        provider: 'p'.repeat(33),
        providerId: 'x',
        email: 'a@example.com',
        name: 'alice',
      }).success,
    ).toBe(false);
    expect(
      oauthLoginSchema.safeParse({
        provider: 'github',
        providerId: 'x',
        email: 'a@example.com',
        name: 'a',
      }).success,
    ).toBe(false);
  });

  it('caps recovery emails', () => {
    expect(forgotPasswordSchema.safeParse({ email: `${'a'.repeat(250)}@ex.com` }).success).toBe(
      false,
    );
    expect(resendVerificationSchema.safeParse({ email: `${'a'.repeat(250)}@ex.com` }).success).toBe(
      false,
    );
  });

  it('caps the new password', () => {
    expect(
      resetPasswordSchema.safeParse({ token: 't', newPassword: `Aa1!${'a'.repeat(125)}` }).success,
    ).toBe(false);
  });
});
