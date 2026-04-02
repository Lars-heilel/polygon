import axios from 'axios';

import {
  cleanupTestUser,
  closeConnections,
  findCredentialsByEmail,
  getAuthDb,
  getRedis,
  getVerificationToken,
} from '../support/test-db';

// ── helpers ───────────────────────────────────────────────────────────────────

const uniqueEmail = () =>
  `e2e-login-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

const PASSWORD = 'Password1!';

/** Registers a user and verifies their email — returns a ready-to-login account. */
async function createVerifiedUser(email: string): Promise<void> {
  await axios.post('/api/auth/register', {
    email,
    password: PASSWORD,
    username: 'e2eloginuser',
  });

  const creds = await findCredentialsByEmail(email);
  if (!creds) throw new Error(`Credentials not found for ${email}`);

  const token = await getVerificationToken(creds.id);
  if (!token) throw new Error(`Verification token not found for ${email}`);

  // Verify email via the redirect endpoint (catches the 302 throw from axios)
  try {
    await axios.get('/api/auth/verify-email', {
      params: { token },
      maxRedirects: 0,
    });
  } catch {
    // 302 throws in axios with maxRedirects: 0 — that's expected
  }
}

/** Extracts a specific cookie value from a Set-Cookie header array. */
function extractCookie(setCookie: string[] | undefined, name: string): string | null {
  const entry = (setCookie ?? []).find((c) => c.startsWith(`${name}=`));
  if (!entry) return null;
  return entry.split(';')[0].slice(name.length + 1);
}

// ── teardown ──────────────────────────────────────────────────────────────────

afterAll(async () => {
  await closeConnections();
});

// ── login ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let testEmail: string;

  beforeEach(async () => {
    testEmail = uniqueEmail();
    await createVerifiedUser(testEmail);
  });

  afterEach(async () => {
    await getRedis().del(`login_attempts:${testEmail}`);
    await cleanupTestUser(testEmail);
  });

  it('returns 201 and sets httpOnly access_token + refresh_token cookies', async () => {
    const res = await axios.post('/api/auth/login', {
      email: testEmail,
      password: PASSWORD,
    });

    expect(res.status).toBe(201);

    const setCookie = res.headers['set-cookie'] as string[] | undefined;
    expect(setCookie).toBeDefined();
    expect(setCookie!.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(setCookie!.some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(setCookie!.every((c) => c.includes('HttpOnly'))).toBe(true);
    expect(setCookie!.every((c) => c.includes('SameSite=Strict'))).toBe(true);
  });

  it('saves the refresh token hash to the database', async () => {
    const res = await axios.post('/api/auth/login', {
      email: testEmail,
      password: PASSWORD,
    });

    const creds = await findCredentialsByEmail(testEmail);
    const result = await getAuthDb().query(
      'SELECT * FROM "RefreshToken" WHERE "credentialsId" = $1 AND "revokedAt" IS NULL',
      [creds!.id],
    );

    expect(result.rows.length).toBe(1);

    // Clean up the refresh token
    await getAuthDb().query('DELETE FROM "RefreshToken" WHERE "credentialsId" = $1', [creds!.id]);

    expect(res.status).toBe(201);
  });

  it('returns 401 on wrong password', async () => {
    await expect(
      axios.post('/api/auth/login', { email: testEmail, password: 'WrongPass1!' }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('returns 401 on unknown email', async () => {
    await expect(
      axios.post('/api/auth/login', { email: 'nobody@example.com', password: PASSWORD }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('increments login attempt counter in Redis on failure', async () => {
    await axios
      .post('/api/auth/login', { email: testEmail, password: 'wrong' })
      .catch((_err: unknown) => {
        /* expected failure */
      });
    await axios
      .post('/api/auth/login', { email: testEmail, password: 'wrong' })
      .catch((_err: unknown) => {
        /* expected failure */
      });

    const count = await getRedis().get(`login_attempts:${testEmail}`);
    expect(Number(count)).toBeGreaterThanOrEqual(2);
  });

  it('returns 429 after 5 failed attempts', async () => {
    // Burn through the 5-attempt limit
    for (let i = 0; i < 5; i++) {
      await axios
        .post('/api/auth/login', { email: testEmail, password: 'wrong' })
        .catch((_err: unknown) => {
          /* expected failure */
        });
    }

    await expect(
      axios.post('/api/auth/login', { email: testEmail, password: 'wrong' }),
    ).rejects.toMatchObject({ response: { status: 429 } });
  });

  it('clears login attempt counter in Redis on successful login', async () => {
    // Two failed attempts first
    await axios
      .post('/api/auth/login', { email: testEmail, password: 'wrong' })
      .catch((_err: unknown) => {
        /* expected failure */
      });
    await axios
      .post('/api/auth/login', { email: testEmail, password: 'wrong' })
      .catch((_err: unknown) => {
        /* expected failure */
      });

    // Then succeed
    await axios.post('/api/auth/login', { email: testEmail, password: PASSWORD });

    const count = await getRedis().get(`login_attempts:${testEmail}`);
    expect(count).toBeNull();

    // Clean up refresh token
    const creds = await findCredentialsByEmail(testEmail);
    await getAuthDb().query('DELETE FROM "RefreshToken" WHERE "credentialsId" = $1', [creds!.id]);
  });
});

// ── refresh ───────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  let testEmail: string;

  beforeEach(async () => {
    testEmail = uniqueEmail();
    await createVerifiedUser(testEmail);
  });

  afterEach(async () => {
    const creds = await findCredentialsByEmail(testEmail);
    if (creds) {
      await getAuthDb().query('DELETE FROM "RefreshToken" WHERE "credentialsId" = $1', [creds.id]);
    }
    await cleanupTestUser(testEmail);
  });

  it('returns new cookies and rotates the refresh token', async () => {
    const loginRes = await axios.post('/api/auth/login', {
      email: testEmail,
      password: PASSWORD,
    });
    const oldRefreshToken = extractCookie(
      loginRes.headers['set-cookie'] as string[],
      'refresh_token',
    );

    const refreshRes = await axios.post(
      '/api/auth/refresh',
      {},
      { headers: { Cookie: `refresh_token=${oldRefreshToken}` } },
    );

    expect(refreshRes.status).toBe(201);
    const newRefreshToken = extractCookie(
      refreshRes.headers['set-cookie'] as string[],
      'refresh_token',
    );
    expect(newRefreshToken).toBeDefined();
    expect(newRefreshToken).not.toBe(oldRefreshToken);
  });

  it('revokes the old refresh token after rotation', async () => {
    const loginRes = await axios.post('/api/auth/login', {
      email: testEmail,
      password: PASSWORD,
    });
    const oldRefreshToken = extractCookie(
      loginRes.headers['set-cookie'] as string[],
      'refresh_token',
    );

    await axios.post(
      '/api/auth/refresh',
      {},
      {
        headers: { Cookie: `refresh_token=${oldRefreshToken}` },
      },
    );

    // Using the old token again must fail (replay attack)
    await expect(
      axios.post(
        '/api/auth/refresh',
        {},
        {
          headers: { Cookie: `refresh_token=${oldRefreshToken}` },
        },
      ),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('returns 401 when no refresh_token cookie is present', async () => {
    await expect(axios.post('/api/auth/refresh')).rejects.toMatchObject({
      response: { status: 401 },
    });
  });

  it('returns 401 for a tampered refresh token', async () => {
    await expect(
      axios.post(
        '/api/auth/refresh',
        {},
        { headers: { Cookie: 'refresh_token=definitely.not.a.real.jwt' } },
      ),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  let testEmail: string;

  beforeEach(async () => {
    testEmail = uniqueEmail();
    await createVerifiedUser(testEmail);
  });

  afterEach(async () => {
    const creds = await findCredentialsByEmail(testEmail);
    if (creds) {
      await getAuthDb().query('DELETE FROM "RefreshToken" WHERE "credentialsId" = $1', [creds.id]);
    }
    await cleanupTestUser(testEmail);
  });

  it('clears auth cookies in the response', async () => {
    const loginRes = await axios.post('/api/auth/login', {
      email: testEmail,
      password: PASSWORD,
    });
    const refreshToken = extractCookie(loginRes.headers['set-cookie'] as string[], 'refresh_token');

    const logoutRes = await axios.post(
      '/api/auth/logout',
      {},
      { headers: { Cookie: `refresh_token=${refreshToken}` } },
    );

    const setCookie = logoutRes.headers['set-cookie'] as string[] | undefined;
    expect(setCookie!.some((c) => c.includes('access_token=;'))).toBe(true);
    expect(setCookie!.some((c) => c.includes('refresh_token=;'))).toBe(true);
  });

  it('revokes the refresh token in the database', async () => {
    const loginRes = await axios.post('/api/auth/login', {
      email: testEmail,
      password: PASSWORD,
    });
    const refreshToken = extractCookie(loginRes.headers['set-cookie'] as string[], 'refresh_token');

    await axios.post(
      '/api/auth/logout',
      {},
      { headers: { Cookie: `refresh_token=${refreshToken}` } },
    );

    // After logout, the refresh token should no longer work
    await expect(
      axios.post('/api/auth/refresh', {}, { headers: { Cookie: `refresh_token=${refreshToken}` } }),
    ).rejects.toMatchObject({ response: { status: 401 } });
  });

  it('returns 201 even when no refresh_token cookie is present', async () => {
    const res = await axios.post('/api/auth/logout');
    expect(res.status).toBe(201);
  });
});
