import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import http from 'k6/http';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

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
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};

export function setup() {
  if (!tokens || tokens.length === 0) {
    throw new Error('load tokens empty: run node infra/load/seed.mjs first');
  }
  return {};
}

// Single-request-per-iteration mix across API_ROUTES.
// Pacing (sleep 2s) keeps `run.sh smoke` (5 VUs / 30s ≈ 70 reqs)
// under the gateway throttle (100 req / 60s) so smoke stays green;
// full stages still saturate the gateway and trip thresholds by design.
export default function () {
  const token = tokens[__VU % tokens.length];
  const chatId = token.chatId;
  const headers = { Cookie: token.cookie };

  const route = __ITER % 4;

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
      { headers: { Cookie: token.cookie, 'Content-Type': 'application/json' } },
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

  sleep(2);
}
