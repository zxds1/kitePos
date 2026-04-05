#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ACTIVE_COLOR_FILE="$ROOT_DIR/deploy/.active_color"
NGINX_UPSTREAM_CONF="$ROOT_DIR/deploy/nginx/active-backend.conf"

CURRENT_COLOR="blue"
if [ -f "$ACTIVE_COLOR_FILE" ]; then
  CURRENT_COLOR="$(cat "$ACTIVE_COLOR_FILE" | tr -d '[:space:]')"
fi
if [ "$CURRENT_COLOR" != "blue" ] && [ "$CURRENT_COLOR" != "green" ]; then
  CURRENT_COLOR="blue"
fi
if [ "$CURRENT_COLOR" = "blue" ]; then
  NEXT_COLOR="green"
else
  NEXT_COLOR="blue"
fi
TARGET_SERVICE="backend_${NEXT_COLOR}"
OLD_SERVICE="backend_${CURRENT_COLOR}"
TARGET_CONTAINER="prod_${TARGET_SERVICE}"

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
echo "Deploying new backend color: $NEXT_COLOR"

docker compose -f "$COMPOSE_FILE" build "$TARGET_SERVICE"
docker compose -f "$COMPOSE_FILE" up -d "$TARGET_SERVICE" nginx

if ! wait_for_healthy "$TARGET_CONTAINER"; then
  echo "ERROR: $TARGET_CONTAINER failed health checks. Stopping new service."
  docker compose -f "$COMPOSE_FILE" stop "$TARGET_SERVICE" || true
  exit 1
fi

cat > "$NGINX_UPSTREAM_CONF" <<EOF
upstream backend_upstream {
  server ${TARGET_SERVICE}:9000;
}
EOF

docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

echo "$NEXT_COLOR" > "$ACTIVE_COLOR_FILE"
echo "Traffic switched to $TARGET_SERVICE. Old service remains available for rollback: $OLD_SERVICE."
