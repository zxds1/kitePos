#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ACTIVE_COLOR_FILE="$ROOT_DIR/deploy/.active_color"
NGINX_UPSTREAM_CONF="$ROOT_DIR/deploy/nginx/active-backend.conf"

if [ ! -f "$ACTIVE_COLOR_FILE" ]; then
  echo "ERROR: Active color file not found at $ACTIVE_COLOR_FILE"
  exit 1
fi

CURRENT_COLOR="$(cat "$ACTIVE_COLOR_FILE" | tr -d '[:space:]')"
if [ "$CURRENT_COLOR" != "blue" ] && [ "$CURRENT_COLOR" != "green" ]; then
  echo "ERROR: Invalid active color: $CURRENT_COLOR"
  exit 1
fi

if [ "$CURRENT_COLOR" = "blue" ]; then
  ROLLBACK_COLOR="green"
else
  ROLLBACK_COLOR="blue"
fi
ROLLBACK_SERVICE="backend_${ROLLBACK_COLOR}"
ROLLBACK_CONTAINER="prod_${ROLLBACK_SERVICE}"

function wait_for_healthy() {
  local container_name="$1"
  local retries=20
  local sleep_seconds=5

  echo "Waiting for health status on $container_name..."
  while [ "$retries" -gt 0 ]; do
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo unknown)"
    echo "  current status: $status"
    if [ "$status" = "healthy" ]; then
      return 0
    fi
    if [ "$status" = "unhealthy" ]; then
      return 1
    fi
    sleep "$sleep_seconds"
    retries=$((retries - 1))
  done
  return 1
}

cd "$ROOT_DIR"

echo "Rolling back to $ROLLBACK_SERVICE"
docker compose -f "$COMPOSE_FILE" up -d "$ROLLBACK_SERVICE"

if ! wait_for_healthy "$ROLLBACK_CONTAINER"; then
  echo "ERROR: rollback target $ROLLBACK_SERVICE is not healthy"
  exit 1
fi

cat > "$NGINX_UPSTREAM_CONF" <<EOF
upstream backend_upstream {
  server ${ROLLBACK_SERVICE}:9000;
}
EOF

docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

echo "$ROLLBACK_COLOR" > "$ACTIVE_COLOR_FILE"

echo "Rollback complete. Active backend is now $ROLLBACK_SERVICE."
