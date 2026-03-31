import axios, { AxiosError } from 'axios';
import {
  cleanupTestUser,
  closeConnections,
  findCredentialsByEmail,
  getVerificationToken,
} from '../support/test-db';

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

const validBody = (email: string) => ({
  email,
  password: 'Password1!',
  username: 'e2euser',
});

afterAll(async () => {
  await closeConnections();
});

describe('POST /api/auth/register', () => {
  let testEmail: string;

  beforeEach(() => {
    testEmail = uniqueEmail();
  });

  afterEach(async () => {
    await cleanupTestUser(testEmail);
  });

  it('returns 201 with message and sets no auth cookies', async () => {
    const res = await axios.post('/api/auth/register', validBody(testEmail));

    expect(res.status).toBe(201);
    expect(res.data).toEqual({ message: 'Registered successfully' });

    const setCookie = res.headers['set-cookie'] ?? [];
    const cookieStr = Array.isArray(setCookie)
      ? setCookie.join('; ')
      : setCookie;
    expect(cookieStr).not.toContain('access_token');
    expect(cookieStr).not.toContain('refresh_token');
  });

  it('creates unverified credentials in the database', async () => {
    await axios.post('/api/auth/register', validBody(testEmail));

    const creds = await findCredentialsByEmail(testEmail);
    expect(creds).not.toBeNull();
    expect(creds!.is_verified).toBe(false);
  });

  it('returns 409 on duplicate email', async () => {
    await axios.post('/api/auth/register', validBody(testEmail));

    await expect(
      axios.post('/api/auth/register', validBody(testEmail))
    ).rejects.toMatchObject({
      response: { status: 409 },
    });
  });

  it('returns 400 on missing required fields', async () => {
    await expect(
      axios.post('/api/auth/register', { email: 'not-an-email' })
    ).rejects.toMatchObject({
      response: { status: 400 },
    });
  });

  it('returns 400 on weak password', async () => {
    await expect(
      axios.post('/api/auth/register', {
        email: testEmail,
        password: '123',
        username: 'e2euser',
      })
    ).rejects.toMatchObject({
      response: { status: 400 },
    });
  });
});

describe('POST /api/auth/resend-verification', () => {
  let testEmail: string;

  beforeEach(async () => {
    testEmail = uniqueEmail();
    await axios.post('/api/auth/register', validBody(testEmail));
  });

  afterEach(async () => {
    await cleanupTestUser(testEmail);
  });

  it('returns 201 on first resend', async () => {
    const res = await axios.post('/api/auth/resend-verification', {
      email: testEmail,
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ message: 'Verification email sent' });
  });

  it('returns 429 when requested within cooldown window', async () => {
    // First resend sets the cooldown
    await axios.post('/api/auth/resend-verification', { email: testEmail });

    await expect(
      axios.post('/api/auth/resend-verification', { email: testEmail })
    ).rejects.toMatchObject({
      response: { status: 429 },
    });
  });

  it('returns 404 for unknown email', async () => {
    await expect(
      axios.post('/api/auth/resend-verification', {
        email: 'nobody@example.com',
      })
    ).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe('GET /api/auth/verify-email', () => {
  let testEmail: string;

  beforeEach(async () => {
    testEmail = uniqueEmail();
    await axios.post('/api/auth/register', validBody(testEmail));
  });

  afterEach(async () => {
    await cleanupTestUser(testEmail);
  });

  it('returns 400 for an invalid token', async () => {
    await expect(
      axios.get('/api/auth/verify-email', { params: { token: 'bad-token' } })
    ).rejects.toMatchObject({
      response: { status: 400 },
    });
  });

  it('redirects and sets auth cookies for a valid token', async () => {
    const creds = await findCredentialsByEmail(testEmail);
    expect(creds).not.toBeNull();

    const token = await getVerificationToken(creds!.id);
    expect(token).not.toBeNull();

    // Follow redirect manually so we can inspect the intermediate response
    let redirectRes;
    try {
      await axios.get('/api/auth/verify-email', {
        params: { token },
        maxRedirects: 0,
      });
    } catch (err) {
      const axiosErr = err as AxiosError;
      redirectRes = axiosErr.response;
    }

    expect(redirectRes?.status).toBe(302);
    expect(redirectRes?.headers['location']).toContain('/auth/email-verified');

    const cookies: string = (redirectRes?.headers['set-cookie'] ?? []).join(
      '; '
    );
    expect(cookies).toContain('access_token');
    expect(cookies).toContain('refresh_token');
    expect(cookies).toContain('HttpOnly');
  });

  it('marks credentials as verified after successful verification', async () => {
    const creds = await findCredentialsByEmail(testEmail);
    const token = await getVerificationToken(creds!.id);

    try {
      await axios.get('/api/auth/verify-email', {
        params: { token },
        maxRedirects: 0,
      });
    } catch {
      // 302 throws in axios
    }

    const updated = await findCredentialsByEmail(testEmail);
    expect(updated!.is_verified).toBe(true);
  });

  it('returns 400 when the same token is used twice', async () => {
    const creds = await findCredentialsByEmail(testEmail);
    const token = await getVerificationToken(creds!.id);

    // First use
    try {
      await axios.get('/api/auth/verify-email', {
        params: { token },
        maxRedirects: 0,
      });
    } catch {
      // 302
    }

    // Second use — token was consumed
    await expect(
      axios.get('/api/auth/verify-email', { params: { token } })
    ).rejects.toMatchObject({
      response: { status: 400 },
    });
  });
});
