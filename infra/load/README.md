# Load tests

Поднять: `npm run dev:docker:up` then `npm run dev:all`.
Гонять из корня: `bash infra/load/run.sh smoke|http|ws`.
Смотреть: Grafana `:3009` дашборд `polygon-backend-overview`, Prometheus `:9090`.
Throttle: замер 1 как есть (100/60с), замер 2 с поднятым лимитом только на время прогона.
Сиды: `node infra/load/seed.mjs`, чистка `node infra/load/cleanup.mjs`.
SEED_N=1000: ~15 мин из-за anon-лимита 100/мин, паузы автоматические.

## Results 2026-10-01

Gateway throttle as-is (100 req / 60s per IP, `gateway.module.ts`) — prod code untouched.
Seed: 50 users, login-only re-entry after verify SQL (throttle cooldown observed between seed and runs).

| stage      | VU         | RPS           | p95                    | err                                       | note                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------- | ---------- | ------------- | ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| smoke http | 5          | 2.44          | 72.76ms                | 0% (0/75)                                 | under throttle, all checks green incl. X-Cache                                                                                                                                                                                                                                                                                                                                              |
| http ramp  | 50/200/500 | ~102          | 8.72ms                 | 94.53% (34868/36884)                      | NAT limit: single-IP throttle 429s, not service ceiling; p95 low because 429s return fast                                                                                                                                                                                                                                                                                                   |
| ws short   | 5          | 3.28 iter/s   | sess 539.56ms          | 0% (400/400 checks)                       | message:new received, zero send:error; session p95 dominated by 500ms join→send delay                                                                                                                                                                                                                                                                                                       |
| ws full    | 100        | 64.82 iter/s  | sess 570.58ms          | 0% (47064/47064 checks)                   | 11766 iters/3m, message:new 11766/11766, zero send:error; ws_connecting p95 4.42ms                                                                                                                                                                                                                                                                                                          |
| ws Ц2      | 1000       | 143.84 iter/s | iter avg 6.83s/p95 11s | 46.21% checks (message:new 268/27473 ≈1%) | Ц2 NOT MET (53.78%<99%): join-ack ~7%, ~86% RATE_LIMITED (20 writers/user vs WS_SEND_LIMIT 30/min — test artifact); joined-path echo ≈7% → genuine join/RPC-path saturation, self-recovered in ~3 min (5VU green). Caveat: script resends chat:join up to 5x while awaiting ack (gateway join-race workaround) — numbers measure the joined path, optimistic on CHECK_MEMBERSHIP RPC volume |

Bottleneck: gateway per-IP throttle (expected). Service ceiling above throttle still needs a
distinct-IP / raised-limit window (out of scope, needs approval) — gateway override not attempted here.

## Results 2026-10-02 (phase 2, gateway cluster: 6 workers on shared :3000, redis adapter, metrics aggregated on 127.0.0.1:3110 — 3100 is Loki's port, see concerns)

Membership invalidation: TTL-only 45s (socket `chat:leave` leaves the room only, no membership-cache invalidation; no leave/kick/removeMember HTTP endpoints in gateway; service re-checks authoritatively).

Seed: 50 users (SEED_N=1000 not run — infeasible single-box: login-only refresh of 1000 users
takes ~14–17 мин — anon 100/мин + ~1с bcrypt/login sequential — vs 15-мин access-token TTL,
so the first users' cookies expire before/during any run; needs multi-IP seeding or a
raised-limit window — input for Plan 3). Tokens refreshed via SEED_LOGIN_ONLY=1 right before
each run. Cluster rebuilt from current sources and restarted from dist (no `nx serve`).

| stage | VU | RPS | p95 | err | note |
| ----- | -- | --- | --- | --- | ---- |
| C1 paced RATE=1000 / 5 мин (50 users) | 725–2000 | ~325 served (200k dropped iters) | 17.99s | 20.39% (20333/99715) | Ц1 NOT MET. Write path 500s: chat-service Prisma `Unable to start a transaction in the given time` (tx-pool saturation on single-box Postgres); reads all green. Confounds: 50 users → ~1200 req/мин/user vs USER_THROTTLE 300/мин; k6 generator on the same box competing for CPU (dropped_iterations). |
| C1 paced RATE=200 / 5 мин (50 users, diagnostic within throttle budget) | ~7–163 | 199.94 | 98.55ms | 0% (0/60001) | GREEN. All checks 100% incl. POST 201. Genuine cluster signal: mixed read/write at 200 RPS with ~40ms avg. |
| C2 ws 50 VU / 3 мин (scenario as-is) | 50 | 44.9 iters/s | iter p95 1.2s; ws_connecting p95 4.04ms | msg_new_ok 55.5% (4500/8106) | Threshold NOT MET. 100% of failures = WS_SEND_LIMIT throttle: 3606 `socket_message_send_rate_limited` events = 3606 failed. Joins 8118/8118 (join-race fix holds). Scenario cadence ~1 msg/2.1s ≈ 28.6/мин/user vs limit 30/мин — scenario-vs-limit mismatch, not a delivery defect. |
| C2 ws 25 VU / 3 мин | 25 | 22.3 iters/s | ws_connecting p95 3.55ms | msg_new_ok 55.9% (2250/4023) | Same cause: +1773 rate-limited events = 1773 failed. Proves per-VU cadence (not VU count) drives the throttle — VU→user pinning 1:1 while VUs ≤ tokens. |
| C2 ws-paced diagnostic (sleep 4, /tmp only, not committed) | 25 | ~12/min/user | ws_connecting p95 ~3ms | msg_new_ok 100% (1089/1089), all checks green | Delivery path HEALTHY when under the throttle limit. |
| xworker cross-worker check (`infra/load/xworker-check.mjs`, 6 rounds, staggered connects, both directions) | — | — | — | 6/6 rounds pass | No worker crashes; placement not steerable (kernel) — 6 rounds make same-worker-only placement negligible; stated honestly. |

Cluster verify: primary + 6 workers (`Gateway primary starting 6 workers`), `socket_redis_adapter_ready`
6/6, aggregator serves 135 `polygon_*` series incl. merged `polygon_http_requests_total`,
`/other` → 404, `X-RateLimit-Limit: 300` headers present on authed routes.
Paced scenario: `infra/load/scenarios/http-paced.js` (`RATE` env iters/s, constant-arrival-rate, 5 мин;
phase-1 `/tmp/opencode/http-paced.js` did not survive the box reboot — faithful reconstruction,
same 4-route mix + thresholds).
Cross-worker script: `infra/load/xworker-check.mjs` (`node infra/load/xworker-check.mjs [rounds]`).

Concerns for Plan 3: (1) `GATEWAY_METRICS_PORT` default was 3100, colliding with Loki (`:3100`) —
aggregator was run on 3110 via env override; default + `prometheus.yml` target changed to 3110.
(2) Gateway request-completed log prints full `set-cookie` incl. live JWT access/refresh tokens —
secrets-in-logs violation, scrub `set-cookie`/`authorization` from the HTTP log middleware.
(3) C2 scenario cadence (~28.6/min/user) sits inside the WS_SEND_LIMIT 30/min envelope —
pace the committed scenario to ≤20/min/user (or raise the limit with justification) so Ц2
measures delivery, not throttle. (4) Single-box 1000-user runs need a seeding story that fits
the 15-мин token TTL (parallel login, multi-IP, or longer-lived load-test tokens).
(5) Emergency fix this round (own commit, needs review): `socket.join(...).catch()` crashed every
worker on each WS connect (`join` is sync void in socket.io 4.8; the async mock hid it) —
removed `.catch`, mocks made sync. Without it the cluster crash-looped and no WS measurement
was possible.

## Results 2026-10-02 (task 7, uuid/PG18 verification on PG18, 133052 msgs)

Message storage post-uuid (no pre-change baseline was recorded — current sizes + math only):
total 28 MB (heap 16 MB, indexes 12 MB); pkey 4120 kB, chat_created_id 7680 kB,
deleted_at 912 kB, chat_client partial 16 kB. uuid 16 B vs CUID text ~26 B ≈ 10 B saved
per uuid column value (~30 B/row over id/chat_id/sender_id ≈ ~4 MB at 133k rows, estimate).
Stack rebuilt from HEAD (`f7bb561`) — primary + 6 workers, 6/6 services, seed 50/50 login refresh.

| stage      | VU  | RPS  | p95                    | err                 | note                                                                                                         |
| ---------- | --- | ---- | ---------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------ |
| smoke http | 5   | 2.41 | 247.83ms (p90 89.85ms) | 0% (115/115 checks) | GREEN. POST 201 + round-trip over uuid schema — protocol compat confirmed; stack left running on fresh dists |

Backend regression green (common 4, auth-lib 92, core 42, user-lib 11, media-lib 12,
chat-lib 57, gateway 91; \*-service apps no tests). Pre-existing reds untouched by phase:
messenger UI drift (11), shared virtual-feed localStorage env (4), backend
notification/search targets fail on zero tests (missing --passWithNoTests).
