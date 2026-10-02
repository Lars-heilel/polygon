// Paced HTTP load for Ц1: constant arrival rate (reconstructed — the phase-1
// /tmp/opencode/http-paced.js did not survive the box reboot; same 4-route mix
// as http-load.js, thresholds identical: p95<500ms, errors<1%).
// Usage (from repo root):
//   RATE=1000 docker run --rm --network host -v "$PWD/infra/load:/scripts" \
//     -e BASE_URL=http://localhost:3000 -e RATE=1000 grafana/k6 run \
//     /scripts/scenarios/http-paced.js
// k6 env quirk: __ENV inside docker is set via -e, so RATE passes through.
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import http from 'k6/http';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const RATE = Number(__ENV.RATE || '1000');

const tokens = new SharedArray('load-tokens', () => {
  const raw = open('/scripts/.tokens.json');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      'load tokens empty: run node infra/load/seed.mjs first (.tokens.json must be [{email,cookie,chatId}])',
    );
  }
  return parsed;
});

export const options = {
  scenarios: {
    paced: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 600,
      maxVUs: 2000,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  if (!tokens || tokens.length === 0) {
    throw new Error('load tokens empty: run node infra/load/seed.mjs first');
  }
  if (tokens.some((t) => !t.cookie || !t.chatId))
    throw new Error(
      'load tokens invalid (missing cookie/chatId): re-run seed verify step (node infra/load/seed.mjs)',
    );
  return {};
}

// Same 4-route mix as http-load.js (API_ROUTES). Iteration index spreads VUs
// across tokens so per-user throttle (300/min) is not the measured ceiling:
// at RATE=1000 with 1000 users each user sees ~60 req/min.
// k6 runs one JS runtime per VU, so `iter` is per-VU; offset by __VU so VUs
// do not all start on token[0].
let iter = 0;
export default function () {
  const n = iter++;
  const token = tokens[(__VU + n) % tokens.length];
  const chatId = token.chatId;
  const headers = { Cookie: token.cookie };

  const route = n % 4;

  if (route === 0) {
    const res = http.get(`${BASE}/api/chats`, { headers });
    check(res, {
      'GET /api/chats 200': (r) => r.status === 200,
      'GET /api/chats X-Cache present': (r) => !!r.headers['X-Cache'],
    });
  } else if (route === 1) {
    const res = http.get(`${BASE}/api/chats/${chatId}/messages?take=20`, { headers });
    check(res, {
      'GET messages 200': (r) => r.status === 200,
      'GET messages X-Cache present': (r) => !!r.headers['X-Cache'],
    });
  } else if (route === 2) {
    const res = http.post(
      `${BASE}/api/chats/${chatId}/messages`,
      JSON.stringify({ type: 'TEXT', text: 'load hello' }),
      { headers: { ...headers, 'Content-Type': 'application/json' } },
    );
    check(res, {
      'POST messages 201': (r) => r.status === 201,
    });
  } else {
    const res = http.get(`${BASE}/api/search/users?q=load&limit=20`, { headers });
    check(res, {
      'GET search/users 200': (r) => r.status === 200,
    });
  }
}
