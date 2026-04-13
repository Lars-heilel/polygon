export interface IAuthCacheRepository {
  // ── Email verification ──────────────────────────────────────────────
  setVerificationToken(token: string, credentialsId: string): Promise<void>;
  getCredentialsIdByVerificationToken(token: string): Promise<string | null>;
  getVerificationTokenByCredentialsId(credentialsId: string): Promise<string | null>;
  deleteVerificationTokens(token: string, credentialsId: string): Promise<void>;
  setResendCooldown(email: string): Promise<void>;
  getResendCooldown(email: string): Promise<string | null>;

  // ── Password reset ──────────────────────────────────────────────────
  setPasswordResetToken(token: string, credentialsId: string): Promise<void>;
  getCredentialsIdByResetToken(token: string): Promise<string | null>;
  getResetTokenByCredentialsId(credentialsId: string): Promise<string | null>;
  deletePasswordResetTokens(token: string, credentialsId: string): Promise<void>;
  setResetCooldown(email: string): Promise<void>;
  getResetCooldown(email: string): Promise<string | null>;

  // ── Login attempts ──────────────────────────────────────────────────
  incrementLoginAttempts(email: string): Promise<number>;
  clearLoginAttempts(email: string): Promise<void>;
}
