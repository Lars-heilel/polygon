import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import ws from 'k6/ws';

const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/^http/, 'ws');

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
  vus: 100,
  duration: '3m',
  thresholds: { checks: ['rate>0.99'] },
};

export function setup() {
  if (!tokens || tokens.length === 0) {
    throw new Error('load tokens empty: run node infra/load/seed.mjs first');
  }
  return {};
}

// WS load: socket.io (engine.io v4) message:send -> message:new.
// Gateway: apps/backend/gateway/src/gateways/chat.socket-gateway.ts
//   auth via `access_token` cookie, payload { chatId, type: 'TEXT', text }
//   per sendMessageSchema (TEXT requires text).
// Success = `message:new` received; `message:send:error` counts as error.
export default function () {
  const token = tokens[__VU % tokens.length];
  const chatId = token.chatId;
  const text = `load ${__VU}-${__ITER}`;

  let gotNew = false;
  let gotError = '';
  let connected = false;

  const url = `${BASE}/socket.io/?EIO=4&transport=websocket`;
  const res = ws.connect(url, { headers: { Cookie: token.cookie } }, function (socket) {
    socket.on('open', function () {
      // engine.io v4: open default namespace
      socket.send('40');
    });

    socket.on('message', function (data) {
      const msg = String(data);

      // engine.io ping -> pong, keep the connection alive
      if (msg === '2') {
        socket.send('3');
        return;
      }

      // namespace connected -> join chat first; send the message after a
      // short delay so the async server-side join (CHECK_MEMBERSHIP RPC +
      // socket.join) lands before SEND_MESSAGE broadcasts to the room.
      // Without the delay the sender is not yet in `chat:${chatId}` and
      // misses its own `message:new` (no error, but no broadcast either).
      if (msg.startsWith('40')) {
        connected = true;
        socket.send(`42["chat:join",${JSON.stringify({ chatId })}]`);
        socket.setTimeout(function () {
          socket.send(`42["message:send",${JSON.stringify({ chatId, type: 'TEXT', text })}]`);
        }, 500);
        return;
      }

      if (msg.includes('message:new')) {
        gotNew = true;
        socket.close();
        return;
      }

      if (msg.includes('message:send:error')) {
        gotError = msg.slice(0, 300);
        socket.close();
        return;
      }

      if (msg.includes('auth:error')) {
        gotError = msg.slice(0, 300);
        socket.close();
      }
    });

    socket.on('error', function (e) {
      gotError = String(e).slice(0, 300);
    });

    socket.setTimeout(function () {
      socket.close();
    }, 5000);
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 });
  check({ connected }, { 'socket.io namespace connected': (o) => o.connected });
  check({ gotError }, { 'no message:send:error': (o) => !o.gotError });
  check({ gotNew }, { 'message:new received': (o) => o.gotNew });

  sleep(1);
}
