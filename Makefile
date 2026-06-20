.PHONY: help install build dev start test test-watch test-coverage lint \
	generate migrate migrate-dev seed setup env docker-env-check \
	infra-up infra-down docker-up docker-down docker-build docker-logs docker-restart \
	docker-migrate docker-seed prod-up prod-local clean

NPM ?= npm
DOCKER_COMPOSE ?= docker compose

# Default target
help:
	@echo "E-Commerce Products Service — available commands:"
	@echo ""
	@echo "  Setup & install"
	@echo "    make install       Install npm dependencies"
	@echo "    make env           Copy .env.example to .env (if missing)"
	@echo "    make setup         Full local setup: env, install, generate, infra, migrate, seed"
	@echo ""
	@echo "  Development"
	@echo "    make dev           Run app in watch mode (requires infra-up)"
	@echo "    make build         Compile TypeScript"
	@echo "    make start         Run compiled app"
	@echo "    make generate      Generate Prisma client"
	@echo "    make migrate       Apply migrations (production)"
	@echo "    make migrate-dev   Create/apply migrations (development)"
	@echo "    make seed          Seed database"
	@echo ""
	@echo "  Quality"
	@echo "    make test          Run tests"
	@echo "    make test-watch    Run tests in watch mode"
	@echo "    make test-coverage Run tests with coverage"
	@echo "    make lint          Run ESLint"
	@echo ""
	@echo "  Docker"
	@echo "    make docker-up     First-time ready: env, pull, build, infra, migrate, seed, app"
	@echo "    make infra-up      Start Postgres, Redis, Elasticsearch, Kafka"
	@echo "    make infra-down    Stop infrastructure containers"
	@echo "    make docker-down   Stop full stack"
	@echo "    make docker-build  Build products-service image"
	@echo "    make docker-migrate Run migrations inside Docker"
	@echo "    make docker-seed   Seed database inside Docker"
	@echo "    make docker-logs   Tail products-service logs"
	@echo "    make docker-restart Rebuild and restart full stack"
	@echo "    make prod-up       Production start (Docker: build, migrate, app — no seed)"
	@echo "    make prod-local    Production start on host (npm ci, build, migrate, start)"
	@echo ""
	@echo "  Cleanup"
	@echo "    make clean         Remove dist/ and coverage/"

install:
	$(NPM) install

env:
	node -e "const fs=require('fs'); if(!fs.existsSync('.env')){fs.copyFileSync('.env.example','.env'); console.log('Created .env from .env.example');} else {console.log('.env already exists');}"

docker-env-check: env
	node scripts/check-env.js

build:
	$(NPM) run build

dev:
	$(NPM) run dev

start:
	$(NPM) start

test:
	$(NPM) test

test-watch:
	$(NPM) run test:watch

test-coverage:
	$(NPM) run test:coverage

lint:
	$(NPM) run lint

generate:
	$(NPM) run generate

migrate:
	$(NPM) run migrate

migrate-dev:
	$(NPM) run migrate:dev

seed:
	$(NPM) run seed

setup: env install generate infra-up migrate-dev seed
	@echo "Setup complete. Run 'make dev' to start the service."

infra-up:
	$(DOCKER_COMPOSE) up -d postgres redis elasticsearch kafka

infra-down:
	$(DOCKER_COMPOSE) stop postgres redis elasticsearch kafka

docker-wait-postgres:
	@echo "Waiting for PostgreSQL..."
	@$(DOCKER_COMPOSE) exec -T postgres sh -c 'until pg_isready -U products -d products_db >/dev/null 2>&1; do sleep 2; done'

DOCKER_MIGRATE = $(DOCKER_COMPOSE) run --rm --no-deps \
	-e DATABASE_URL=postgresql://products:products_secret@postgres:5432/products_db?schema=public \
	products-service sh -c "npx prisma migrate deploy"

docker-migrate: docker-wait-postgres
	@echo "Applying database migrations..."
	@$(DOCKER_MIGRATE)

docker-seed: docker-wait-postgres
	@echo "Seeding database..."
	@$(DOCKER_COMPOSE) run --rm --no-deps \
		-e DATABASE_URL=postgresql://products:products_secret@postgres:5432/products_db?schema=public \
		products-service sh -c "npx tsx prisma/seed.ts"

docker-up: docker-env-check
	@echo "==> Pulling infrastructure images..."
	@$(DOCKER_COMPOSE) pull postgres redis elasticsearch kafka
	@echo "==> Building products-service..."
	@$(DOCKER_COMPOSE) build products-service
	@echo "==> Starting infrastructure (Postgres, Redis, Elasticsearch, Kafka)..."
	@$(DOCKER_COMPOSE) up -d postgres redis elasticsearch kafka
	@$(MAKE) docker-migrate
	@$(MAKE) docker-seed
	@echo "==> Starting products-service..."
	@$(DOCKER_COMPOSE) up -d products-service
	@echo ""
	@echo "Stack is ready."
	@echo "  HTTP API:  http://localhost:3001"
	@echo "  Swagger:   http://localhost:3001/api/docs"
	@echo "  gRPC:      localhost:50051"
	@echo ""
	@echo "Logs: make docker-logs"

docker-down:
	$(DOCKER_COMPOSE) down

docker-build:
	$(DOCKER_COMPOSE) build products-service

docker-logs:
	$(DOCKER_COMPOSE) logs -f products-service

docker-restart: docker-down docker-up

prod-up:
	bash scripts/start-production.sh

prod-local:
	bash scripts/start-production.sh --local

clean:
	node -e "const fs=require('fs'); ['dist','coverage'].forEach(d=>fs.rmSync(d,{recursive:true,force:true}))"
