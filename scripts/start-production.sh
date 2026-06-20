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
node scripts/check-production-env.js

if [[ "$MODE" == "local" ]]; then
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

DOCKER_COMPOSE="${DOCKER_COMPOSE:-docker compose}"

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
