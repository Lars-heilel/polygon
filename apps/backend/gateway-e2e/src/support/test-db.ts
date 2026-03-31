import Redis from 'ioredis';
import { Pool } from 'pg';

let pgPool: Pool | null = null;
let redisClient: Redis | null = null;

export function getAuthDb(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString:
        process.env['AUTH_DATABASE_URL'] ??
        'postgresql://polygon:polygon_password@localhost:5432/polygon_auth',
    });
  }
  return pgPool;
}

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: Number(process.env['REDIS_PORT'] ?? 6379),
      password: process.env['REDIS_PASSWORD'] || undefined,
      lazyConnect: true,
    });
  }
  return redisClient;
}

export async function closeConnections(): Promise<void> {
  await pgPool?.end();
  await redisClient?.quit();
  pgPool = null;
  redisClient = null;
}

/** Returns the verification token stored in Redis for the given credentialsId. */
export async function getVerificationToken(credentialsId: string): Promise<string | null> {
  return getRedis().get(`email_verification_id:${credentialsId}`);
}

/** Returns the credentials row for an email, or null if not found. */
export async function findCredentialsByEmail(
  email: string,
): Promise<{ id: string; is_verified: boolean } | null> {
  const result = await getAuthDb().query<{ id: string; is_verified: boolean }>(
    'SELECT id, is_verified FROM "Credentials" WHERE email = $1',
    [email],
  );
  return result.rows[0] ?? null;
}

/** Hard-deletes credentials and all related Redis keys for a test email. */
export async function cleanupTestUser(email: string): Promise<void> {
  const creds = await findCredentialsByEmail(email);
  if (creds) {
    const token = await getVerificationToken(creds.id);
    if (token) {
      await getRedis().del(`email_verification:${token}`);
    }
    await getRedis().del(`email_verification_id:${creds.id}`, `resend_cooldown:${email}`);
    await getAuthDb().query('DELETE FROM "Credentials" WHERE id = $1', [creds.id]);
  }
}
