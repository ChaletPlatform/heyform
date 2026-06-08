#!/usr/bin/env bash
set -euo pipefail

# Blue-green zero-downtime deploy for HeyForm
# Usage: deploy.sh [image_tag]
#   image_tag defaults to "latest"

COMPOSE_DIR="/opt/heyform"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"
IMAGE="ghcr.io/chaletplatform/heyform"
TAG="${1:-latest}"
HEALTH_URL="http://127.0.0.1:9157/health/ready"
MAX_WAIT=120  # seconds to wait for health check

cd "$COMPOSE_DIR"

log() { echo "[deploy] $(date '+%H:%M:%S') $*"; }

# Determine which slot is currently running
if docker ps --format '{{.Names}}' | grep -q '^heyform-blue$'; then
    OLD_SLOT="blue"
    NEW_SLOT="green"
elif docker ps --format '{{.Names}}' | grep -q '^heyform-green$'; then
    OLD_SLOT="green"
    NEW_SLOT="blue"
else
    # Neither running — cold start blue
    OLD_SLOT=""
    NEW_SLOT="blue"
fi

log "Active slot: ${OLD_SLOT:-none} → deploying to: $NEW_SLOT"

# Pull latest image
log "Pulling $IMAGE:$TAG"
docker pull "$IMAGE:$TAG"

# Start new slot
log "Starting heyform-$NEW_SLOT"
if [ "$NEW_SLOT" = "green" ]; then
    docker compose -f docker-compose.yml --profile green up -d "heyform-$NEW_SLOT"
else
    docker compose -f docker-compose.yml up -d "heyform-$NEW_SLOT"
fi

# Wait for new container to be healthy
log "Waiting for heyform-$NEW_SLOT to become healthy (max ${MAX_WAIT}s)"
elapsed=0
while [ $elapsed -lt $MAX_WAIT ]; do
    health=$(docker inspect --format='{{.State.Health.Status}}' "heyform-$NEW_SLOT" 2>/dev/null || echo "missing")
    if [ "$health" = "healthy" ]; then
        log "heyform-$NEW_SLOT is healthy after ${elapsed}s"
        break
    fi
    sleep 5
    elapsed=$((elapsed + 5))
done

if [ "$health" != "healthy" ]; then
    log "ERROR: heyform-$NEW_SLOT failed to become healthy after ${MAX_WAIT}s"
    log "Rolling back — stopping new slot"
    docker compose -f docker-compose.yml stop "heyform-$NEW_SLOT"
    docker compose -f docker-compose.yml rm -f "heyform-$NEW_SLOT"
    exit 1
fi

# Caddy automatically routes to the healthy upstream, so once the new
# container is healthy it's already receiving traffic. Now stop the old one.
if [ -n "$OLD_SLOT" ]; then
    log "Stopping heyform-$OLD_SLOT"
    docker compose -f docker-compose.yml stop "heyform-$OLD_SLOT"
    docker compose -f docker-compose.yml rm -f "heyform-$OLD_SLOT"
fi

# Clean up old images
log "Pruning unused images"
docker image prune -f --filter "until=1h" > /dev/null 2>&1 || true

log "Deploy complete — heyform-$NEW_SLOT is live"
