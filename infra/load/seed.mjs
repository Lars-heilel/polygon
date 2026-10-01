// Load-test seed: registers load_* users, logs in, creates self-chats.
// Contracts: shapes from libs/common zod schemas, routes from API_ROUTES
// (auth/register, auth/login, chats/self). Global prefix `api`, so
// endpoints are `${BASE}/api/auth/register`, `${BASE}/api/auth/login`,
// `${BASE}/api/chats/self`.
// Register shape: { email, password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^\w\s]).{8,}$/, username min 2 }.
// Login is blocked until isVerified=true (auth.service validateCredentials).
// Test-only SQL exception for seed (forbidden in prod code).
// Table is quoted CamelCase — lowercase `credentials` updates 0 rows.
// Exact working statement, run once on polygon_auth per fresh seed:
//   UPDATE "Credentials" SET "is_verified"=true WHERE email LIKE 'load\_%@example.com';
// 2-step re-entry (login blocked until isVerified=true):
//   1) SEED_N=2 node infra/load/seed.mjs   (register; login 401 expected)
//   2) psql polygon_auth → run SQL above
//   3) SEED_LOGIN_ONLY=1 node infra/load/seed.mjs   (reuses .tokens.json emails, login+self-chat)
// Logging rule: no secrets — only eventType + presence flags/counts.
import fs from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const N = Number(process.env.SEED_N ?? '50');
const PASS = 'Load1234!x';
const OUT_PATH = new URL('./.tokens.json', import.meta.url);

const log = (obj) => console.log(JSON.stringify(obj));

const LOGIN_ONLY = ['1', 'true', 'yes'].includes(
  String(process.env.SEED_LOGIN_ONLY ?? process.env.LOGIN_ONLY ?? '').toLowerCase(),
);

// Phase 1: register loop (skipped in login-only re-entry; reuses .tokens.json emails).
const users = [];
if (LOGIN_ONLY) {
  const raw = fs.readFileSync(OUT_PATH, 'utf8');
  const prev = JSON.parse(raw);
  if (!Array.isArray(prev) || prev.length === 0) {
    log({ eventType: 'load_seed_login_only_empty', hasUsers: false });
    throw new Error('login-only mode: .tokens.json missing or empty, run fresh seed first');
  }
  for (const p of prev) users.push({ email: p.email, password: p.password, username: p.username });
  log({ eventType: 'load_seed_login_only', hasUsers: true, count: users.length });
} else {
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
    if ((i + 1) % 80 === 0) {
      console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
      await new Promise((r) => setTimeout(r, 65000));
    }
  }
}

// Phase 2: test-only SQL hint (login blocked until isVerified=true).
// NOTE: intentionally no email literals / passwords / tokens in logs.
log({
  eventType: 'load_seed_verify_hint',
  hint: 'test-only SQL on polygon_auth: UPDATE "Credentials" SET "is_verified"=true WHERE email LIKE load-prefix; then re-run with SEED_LOGIN_ONLY=1',
  hasUsers: users.length > 0,
  count: users.length,
  loginOnly: LOGIN_ONLY,
});

// Phase 3: login + self-chat loop, saving { email, cookie, chatId }.
const out = [];
for (let i = 0; i < users.length; i++) {
  const u = users[i];
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
      if ((i + 1) % 80 === 0) {
        console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
        await new Promise((r) => setTimeout(r, 65000));
      }
      continue;
    }
    if (!login.ok) {
      log({ eventType: 'load_seed_login_error', hasEmail: true, status: login.status });
      out.push({ email: u.email, password: u.password, cookie, chatId });
      if ((i + 1) % 80 === 0) {
        console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
        await new Promise((r) => setTimeout(r, 65000));
      }
      continue;
    }
    const rawCookies =
      typeof login.headers.getSetCookie === 'function'
        ? login.headers.getSetCookie()
        : (login.headers.get('set-cookie') ?? '').split(/,(?=[^;]+=[^;]+;)/).filter(Boolean);
    cookie = rawCookies.map((c) => c.split(';')[0]).join('; ');
    log({ eventType: 'load_seed_logged_in', hasEmail: true, hasCookie: cookie.length > 0 });
  } catch {
    log({ eventType: 'load_seed_login_error', hasEmail: true, status: 'fetch_failed' });
    out.push({ email: u.email, password: u.password, cookie, chatId });
    if ((i + 1) % 80 === 0) {
      console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
      await new Promise((r) => setTimeout(r, 65000));
    }
    continue;
  }

  if (!cookie) {
    log({ eventType: 'load_seed_self_chat_skipped', hasCookie: false });
    out.push({ email: u.email, password: u.password, cookie, chatId });
    if ((i + 1) % 80 === 0) {
      console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
      await new Promise((r) => setTimeout(r, 65000));
    }
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
      if ((i + 1) % 80 === 0) {
        console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
        await new Promise((r) => setTimeout(r, 65000));
      }
      continue;
    }
    const body = await self.json().catch(() => null);
    chatId = body?.id ?? body?.chat?.id ?? body?.chatId ?? null;
    log({ eventType: 'load_seed_self_chat_done', hasCookie: !!cookie, hasChatId: !!chatId });
  } catch {
    log({ eventType: 'load_seed_self_chat_error', hasCookie: !!cookie, status: 'fetch_failed' });
  }
  out.push({ email: u.email, password: u.password, cookie, chatId });
  if ((i + 1) % 80 === 0) {
    console.log(JSON.stringify({ eventType: 'load_seed_throttle_pause', done: i + 1 }));
    await new Promise((r) => setTimeout(r, 65000));
  }
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
if (withChat === 0) {
  log({
    eventType: 'load_seed_chats_missing',
    hasChats: false,
    next: 'apply verify SQL on polygon_auth, then re-run with SEED_LOGIN_ONLY=1; do not load-test with null chatId',
  });
  process.exitCode = 1;
}
