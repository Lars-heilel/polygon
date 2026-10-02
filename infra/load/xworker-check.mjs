// Cross-worker message:new check (Phase 2 Task 4, carried from Task 3 review).
// Opens N socket pairs with staggered connects in one shared direct chat and
// asserts delivery BOTH ways per round. Kernel-level connection placement on the
// shared :3000 cannot be steered, so same-worker-only placement for ALL rounds is
// made unlikely by rounds (P ≈ (1/W)^(2R-1) for W workers, R rounds; default
// W>=2 assumption, R=6) — stated honestly, not proven per-socket.
// Usage: node infra/load/xworker-check.mjs [rounds]  (reads .tokens.json emails,
// logs in fresh — cookies live 15 min — creates a direct chat A<->B).
// Exit 0 = all rounds delivered both ways; non-zero otherwise. No secrets in logs.
import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ROUNDS = Number(process.argv[2] ?? '6');
const TOKENS_PATH = new URL('./.tokens.json', import.meta.url);

const log = (obj) => console.log(JSON.stringify(obj));

const tokens = (await import('node:fs')).readFileSync(TOKENS_PATH, 'utf8');
const users = JSON.parse(tokens);
if (!Array.isArray(users) || users.length < 2 || !users[0].email || !users[0].password) {
  throw new Error('need >=2 users with email+password in .tokens.json (run seed first)');
}
const [userA, userB] = users;

async function login(u) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  if (!res.ok) throw new Error(`login failed status=${res.status}`);
  const raw = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const cookie = raw.map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('login returned no cookie');
  return cookie;
}

async function meId(cookie) {
  const res = await fetch(`${BASE}/api/users/me`, { headers: { cookie } });
  if (!res.ok) throw new Error(`users/me failed status=${res.status}`);
  const body = await res.json();
  const id = body?.id ?? body?.user?.id;
  if (!id) throw new Error('users/me returned no id');
  return id;
}

function openSocket(cookie) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, {
      extraHeaders: { Cookie: cookie },
      transports: ['websocket'],
      timeout: 8000,
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('connect timeout'));
    }, 9000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(new Error(`connect_error: ${String(err?.message ?? err).slice(0, 120)}`));
    });
  });
}

function joinChat(socket, chatId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join-ack timeout')), 8000);
    socket.once('chat:joined', () => {
      clearTimeout(timer);
      resolve(true);
    });
    socket.once('chat:join:error', (e) => {
      clearTimeout(timer);
      reject(new Error(`join-error: ${JSON.stringify(e).slice(0, 120)}`));
    });
    socket.emit('chat:join', { chatId });
  });
}

function sendAndWait(from, to, chatId, text) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('message:new timeout')), 8000);
    to.once('message:new', (msg) => {
      clearTimeout(timer);
      resolve(!!msg);
    });
    from.emit('message:send', { chatId, type: 'TEXT', text });
  });
}

const cookieA = await login(userA);
const cookieB = await login(userB);
const idA = await meId(cookieA);
log({ eventType: 'xworker_login_ok', hasCookieA: !!cookieA, hasCookieB: !!cookieB, hasIdA: !!idA });

const directRes = await fetch(`${BASE}/api/chats/direct`, {
  method: 'POST',
  headers: { cookie: cookieB, 'content-type': 'application/json' },
  body: JSON.stringify({ targetUserId: idA }),
});
if (!directRes.ok) throw new Error(`direct chat failed status=${directRes.status}`);
const direct = await directRes.json();
const chatId = direct?.id ?? direct?.chat?.id;
if (!chatId) throw new Error('direct chat returned no id');
log({ eventType: 'xworker_chat_ready', hasChatId: !!chatId });

let pass = 0;
for (let r = 0; r < ROUNDS; r++) {
  const sockA = await openSocket(cookieA);
  await new Promise((res) => setTimeout(res, 150)); // stagger connects
  const sockB = await openSocket(cookieB);
  try {
    await Promise.all([joinChat(sockA, chatId), joinChat(sockB, chatId)]);
    await sendAndWait(sockA, sockB, chatId, `xworker ${r} A->B`);
    await sendAndWait(sockB, sockA, chatId, `xworker ${r} B->A`);
    pass += 1;
    log({ eventType: 'xworker_round_pass', round: r });
  } catch (err) {
    log({ eventType: 'xworker_round_fail', round: r, reason: String(err.message).slice(0, 120) });
  } finally {
    sockA.close();
    sockB.close();
    await new Promise((res) => setTimeout(res, 200));
  }
}

log({ eventType: 'xworker_done', passed: pass, rounds: ROUNDS });
if (pass !== ROUNDS) {
  process.exitCode = 1;
}
