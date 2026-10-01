#!/usr/bin/env bash
set -euo pipefail
MODE="${1:-smoke}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
case "$MODE" in
  smoke)
    docker run --rm --network host -v "$PWD/infra/load:/scripts" \
      -e BASE_URL="$BASE_URL" grafana/k6 run \
      --vus 5 --duration 30s /scripts/scenarios/http-load.js
    ;;
  http)
    docker run --rm --network host -v "$PWD/infra/load:/scripts" \
      -e BASE_URL="$BASE_URL" grafana/k6 run /scripts/scenarios/http-load.js
    ;;
  ws)
    docker run --rm --network host -v "$PWD/infra/load:/scripts" \
      -e BASE_URL="$BASE_URL" grafana/k6 run /scripts/scenarios/ws-load.js
    ;;
  *)
    echo "usage: run.sh [smoke|http|ws]" >&2
    exit 1
    ;;
esac
