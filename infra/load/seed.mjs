// Load-test seed: registers load_* users, logs in, creates self-chats.
// Contracts: shapes from libs/common zod schemas, routes from API_ROUTES
// (auth/register, auth/login, chats/self). Global prefix `api`, so
// endpoints are `${BASE}/api/auth/register`, `${BASE}/api/auth/login`,
// `${BASE}/api/chats/self`.
// Register shape: { email, password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, username min 2 }.
// Login is blocked until isVerified=true (auth.service validateCredentials).
// Test-only SQL exception for seed (forbidden in prod code):
//   run once on polygon_auth: UPDATE credentials SET is_verified = true
//   WHERE email LIKE 'load\_%'  (suffix: load users domain)
// Logging rule: no secrets — only eventType + presence flags/counts.

import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const N = Number(process.env.SEED_N ?? '50');
const PASS = 'Load1234!x';
const OUT_PATH = new URL('./.tokens.json', import.meta.url);

const log = (obj) => console.log(JSON.stringify(obj));

// Phase 1: register loop.
const users = [];
for (let i = 0; i < N; i++) {
  const email = `load_${Date.now()}_${i}@example.com`;
  const username = `load_${i}`;
  let reg;
  try {
    reg = await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: PASS, username }),
    });
  } catch (err) {
    log({ eventType: 'load_seed_register_error', hasEmail: true, status: 'fetch_failed' });
    throw err;
  }
  if (!reg.ok && reg.status !== 409) {
    log({ eventType: 'load_seed_register_error', hasEmail: true, status: reg.status });
    throw new Error(`register failed ${reg.status}`);
  }
  users.push({ email, password: PASS, username });
  log({ eventType: 'load_seed_registered', hasEmail: true, index: i });
}

// Phase 2: test-only SQL hint (login blocked until isVerified=true).
// NOTE: intentionally no email literals / passwords / tokens here.
log({
  eventType: 'load_seed_verify_hint',
  hint: 'test-only SQL on polygon_auth: UPDATE credentials SET is_verified=true WHERE email LIKE load-prefix',
  hasUsers: users.length > 0,
  count: users.length,
});

// Phase 3: login + self-chat loop, saving { email, cookie, chatId }.
const out = [];
for (const u of users) {
  let cookie = null;
  let chatId = null;
  try {
    const login = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: u.password }),
    });
    if (login.status === 401) {
      log({ eventType: 'load_seed_login_blocked', hasEmail: true, hasCookie: false });
      out.push({ email: u.email, password: u.password, cookie, chatId });
      continue;
    }
    if (!login.ok) {
      log({ eventType: 'load_seed_login_error', hasEmail: true, status: login.status });
      out.push({ email: u.email, password: u.password, cookie, chatId });
      continue;
    }
    const rawCookies =
      typeof login.headers.getSetCookie === 'function'
        ? login.headers.getSetCookie()
        : (login.headers.get('set-cookie') ?? '')
            .split(/,(?=[^;]+=[^;]+;)/)
            .filter(Boolean);
    cookie = rawCookies.map((c) => c.split(';')[0]).join('; ');
    log({ eventType: 'load_seed_logged_in', hasEmail: true, hasCookie: cookie.length > 0 });
  } catch {
    log({ eventType: 'load_seed_login_error', hasEmail: true, status: 'fetch_failed' });
    out.push({ email: u.email, password: u.password, cookie, chatId });
    continue;
  }

  try {
    const self = await fetch(`${BASE}/api/chats/self`, {
      method: 'POST',
      headers: { cookie },
    });
    if (!self.ok) {
      log({ eventType: 'load_seed_self_chat_error', hasCookie: !!cookie, status: self.status });
      out.push({ email: u.email, password: u.password, cookie, chatId });
      continue;
    }
    const body = await self.json().catch(() => null);
    chatId = body?.id ?? body?.chat?.id ?? body?.chatId ?? null;
    log({ eventType: 'load_seed_self_chat_done', hasCookie: !!cookie, hasChatId: !!chatId });
  } catch {
    log({ eventType: 'load_seed_self_chat_error', hasCookie: !!cookie, status: 'fetch_failed' });
  }
  out.push({ email: u.email, password: u.password, cookie, chatId });
}

fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
const withChat = out.filter((r) => !!r.chatId).length;
log({
  eventType: 'load_seed_done',
  count: out.length,
  hasEmails: out.length > 0,
  withCookies: out.filter((r) => !!r.cookie).length,
  withChats: withChat,
});
