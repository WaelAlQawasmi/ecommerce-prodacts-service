#!/usr/bin/env bash
# Production startup — Docker full stack (default) or local Node (--local).
# Usage:
#   ./scripts/start-production.sh           # Docker: infra + migrate + app
#   ./scripts/start-production.sh --local   # Bare metal: npm ci, build, migrate, start
#   ./scripts/start-production.sh --seed    # Docker with sample seed (non-prod data)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

MODE="docker"
SEED=false

for arg in "$@"; do
  case "$arg" in
    --local) MODE="local" ;;
    --seed) SEED=true ;;
    -h|--help)
      echo "Usage: $0 [--local] [--seed]"
      echo "  --local  Run on the host with Node (no Docker app container)"
      echo "  --seed   Seed sample data (Docker mode only; not recommended for real prod)"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --help)"
      exit 1
      ;;
  esac
done

export NODE_ENV=production
export SWAGGER_ENABLED="${SWAGGER_ENABLED:-false}"

echo "==> Production environment check..."
bash scripts/check-production-env.sh

if [[ "$MODE" == "local" ]]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js 20+ is required for --local mode. Install Node or run without --local (Docker mode)." >&2
    exit 1
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required for --local mode." >&2
    exit 1
  fi

  echo "==> Installing production dependencies..."
  npm ci --omit=dev

  echo "==> Generating Prisma client..."
  npx prisma generate

  echo "==> Building application..."
  npm run build

  echo "==> Applying database migrations..."
  npm run migrate

  echo "==> Starting products-service (NODE_ENV=production)..."
  exec npm start
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker or use --local with Node.js 20+." >&2
  exit 1
fi

DOCKER_COMPOSE="${DOCKER_COMPOSE:-docker compose}"
if ! $DOCKER_COMPOSE version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required (docker compose)." >&2
  exit 1
fi

if [[ -z "${COMPOSE_FILE:-}" ]] && command -v free >/dev/null 2>&1; then
  total_mb=$(free -m | awk '/^Mem:/{print $2}')
  if [[ "$total_mb" -lt 2048 ]]; then
    export COMPOSE_FILE="docker-compose.yml:docker-compose.small.yml"
    echo "Low memory detected (${total_mb}MB RAM) — using docker-compose.small.yml"
    echo "Tip: use a 4GB+ instance for production, or add 2GB swap (see README)."
  fi
fi

check_disk_space() {
  local min_mb="${1:-4096}"
  local avail_kb avail_mb
  avail_kb=$(df -Pk . | awk 'NR==2 {print $4}')
  avail_mb=$((avail_kb / 1024))
  if [[ "$avail_mb" -lt "$min_mb" ]]; then
    echo "Not enough disk space: ${avail_mb}MB free (need at least ${min_mb}MB)." >&2
    echo "Check usage:  df -h && docker system df" >&2
    echo "Free Docker:  docker system prune -a" >&2
    echo "Free builds:  docker builder prune -a" >&2
    exit 1
  fi
  echo "Disk space OK: ${avail_mb}MB free."
}

check_disk_space 4096

echo "==> Pulling infrastructure images..."
$DOCKER_COMPOSE pull postgres redis elasticsearch kafka

echo "==> Building products-service image (NODE_ENV=production)..."
$DOCKER_COMPOSE build --build-arg NODE_ENV=production products-service

echo "==> Starting infrastructure (Postgres, Redis, Elasticsearch, Kafka)..."
$DOCKER_COMPOSE up -d postgres redis elasticsearch kafka

echo "==> Waiting for PostgreSQL..."
$DOCKER_COMPOSE exec -T postgres sh -c \
  'until pg_isready -U products -d products_db >/dev/null 2>&1; do sleep 2; done'

echo "==> Applying database migrations..."
$DOCKER_COMPOSE run --rm --no-deps \
  -e DATABASE_URL=postgresql://products:products_secret@postgres:5432/products_db?schema=public \
  products-service npx prisma migrate deploy

if [[ "$SEED" == true ]]; then
  echo "==> Seeding database..."
  $DOCKER_COMPOSE run --rm --no-deps \
    -e DATABASE_URL=postgresql://products:products_secret@postgres:5432/products_db?schema=public \
    products-service sh -c "npx tsx prisma/seed.ts"
fi

echo "==> Starting products-service..."
$DOCKER_COMPOSE up -d products-service

PORT="${PORT:-3001}"
GRPC_PORT="${GRPC_PORT:-50051}"

echo ""
echo "Production stack is running."
echo "  HTTP API:  http://localhost:${PORT}"
echo "  gRPC:      localhost:${GRPC_PORT}"
echo "  Swagger:   disabled (SWAGGER_ENABLED=false)"
echo ""
echo "Logs: $DOCKER_COMPOSE logs -f products-service"
