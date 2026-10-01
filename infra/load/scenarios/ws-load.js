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
  if (tokens.some((t) => !t.cookie || !t.chatId))
    throw new Error(
      'load tokens invalid (missing cookie/chatId): re-run seed verify step (node infra/load/seed.mjs)',
    );
  return {};
}

// WS load: socket.io (engine.io v4) message:send -> message:new.
// Gateway: apps/backend/gateway/src/gateways/chat.socket-gateway.ts
//   auth via `access_token` cookie, payload { chatId, type: 'TEXT', text }
//   per sendMessageSchema (TEXT requires text).
// Success = `message:new` received; `message:send:error` counts as error.
export default function () {
  const token = tokens[(__VU - 1) % tokens.length];
  const chatId = token.chatId;
  const text = `load ${__VU}-${__ITER}`;

  let gotNew = false;
  let gotError = '';
  let connected = false;
  let joinedAck = false;
  let ackTimeout = false;
  let sent = false;

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

      const sendText = function () {
        if (sent) return;
        sent = true;
        socket.send(`42["message:send",${JSON.stringify({ chatId, type: 'TEXT', text })}]`);
      };

      // server ack for `chat:join` (see chat.socket-gateway handleJoin);
      // send only once the sender is in `chat:${chatId}` so it gets its
      // own `message:new` broadcast.
      if (msg.includes('chat:joined')) {
        joinedAck = true;
        sendText();
        return;
      }

      // namespace connected -> join chat, then wait for the ack above.
      // Race note: handleJoin drops the join silently when it lands before
      // async handleConnection sets socket.data['userId'], so resend the
      // join every 1s while no ack (server logs chat_joined only on success).
      // Fallback: if no ack within 5s, send anyway and flag ackTimeout.
      if (msg.startsWith('40')) {
        connected = true;
        const joinFrame = `42["chat:join",${JSON.stringify({ chatId })}]`;
        socket.send(joinFrame);
        [1000, 2000, 3000, 4000].forEach(function (delay) {
          socket.setTimeout(function () {
            if (!joinedAck && !sent) socket.send(joinFrame);
          }, delay);
        });
        socket.setTimeout(function () {
          if (!sent) {
            ackTimeout = true;
            sendText();
          }
        }, 5000);
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
    }, 10000);
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 });
  check({ connected }, { 'socket.io namespace connected': (o) => o.connected });
  check({ joinedAck }, { 'join-ack received': (o) => o.joinedAck });
  check({ sent }, { 'message sent (ack or fallback)': (o) => o.sent });
  check({ gotError }, { 'no ws errors': (o) => !o.gotError });
  check({ gotNew }, { 'message:new received': (o) => o.gotNew });

  sleep(1);
}
