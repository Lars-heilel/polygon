# Load tests

Поднять: `npm run dev:docker:up` then `npm run dev:all`.
Гонять из корня: `bash infra/load/run.sh smoke|http|ws`.
Смотреть: Grafana `:3009` дашборд `polygon-backend-overview`, Prometheus `:9090`.
Throttle: замер 1 как есть (100/60с), замер 2 с поднятым лимитом только на время прогона.
Сиды: `node infra/load/seed.mjs`, чистка `node infra/load/cleanup.mjs`.

## Results 2026-10-01

Gateway throttle as-is (100 req / 60s per IP, `gateway.module.ts`) — prod code untouched.
Seed: 50 users, login-only re-entry after verify SQL (throttle cooldown observed between seed and runs).

| stage      | VU         | RPS         | p95           | err                  | note                                                                                      |
| ---------- | ---------- | ----------- | ------------- | -------------------- | ----------------------------------------------------------------------------------------- |
| smoke http | 5          | 2.44        | 72.76ms       | 0% (0/75)            | under throttle, all checks green incl. X-Cache                                            |
| http ramp  | 50/200/500 | ~102        | 8.72ms        | 94.53% (34868/36884) | NAT limit: single-IP throttle 429s, not service ceiling; p95 low because 429s return fast |
| ws short   | 5          | 3.28 iter/s | sess 539.56ms | 0% (400/400 checks)  | message:new received, zero send:error; session p95 dominated by 500ms join→send delay     |

Bottleneck: gateway per-IP throttle (expected). Service ceiling above throttle not measured —
full ws profile (100 VU / 3m) and raised-limit http run left for a window with distinct source IPs.
