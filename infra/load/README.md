# Load tests

Поднять: `npm run dev:docker:up` then `npm run dev:all`.
Гонять из корня: `bash infra/load/run.sh smoke|http|ws`.
Смотреть: Grafana `:3009` дашборд `polygon-backend-overview`, Prometheus `:9090`.
Throttle: замер 1 как есть (100/60с), замер 2 с поднятым лимитом только на время прогона.
Сиды: `node infra/load/seed.mjs`, чистка `node infra/load/cleanup.mjs`.
