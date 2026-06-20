# E-Commerce Products Service

A production-ready **Products microservice** built with Node.js, TypeScript, DDD, and TDD. It provides REST APIs for catalog browsing, gRPC for stock reservation, Kafka for stock release events, and Elasticsearch for product search.

## Architecture

```
src/
├── domain/           # Entities, value objects, repository interfaces (DDD)
├── application/    # Use cases (business logic)
├── infrastructure/   # PostgreSQL, Redis, ES, Kafka, gRPC, JWT
├── interfaces/       # HTTP REST + Swagger
└── main.ts           # Bootstrap & dependency wiring
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ / TypeScript |
| REST API | Express + Swagger UI |
| Stock API | gRPC |
| Database | PostgreSQL (Prisma ORM) |
| Search | Elasticsearch 8 |
| Cache / TTL | Redis (reservation expiry) |
| Events | Kafka (stock release) |
| Auth | RS256 JWT from Auth Service |
| Tests | Jest + Supertest |

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- GNU Make (optional — [Git Bash](https://git-scm.com/) or WSL on Windows)

### Make shortcuts

Run `make help` to list all commands.

| Command | Description |
|---------|-------------|
| `make setup` | First-time setup: `.env`, install, Prisma generate, infra, migrate, seed |
| `make dev` | Run app in watch mode |
| `make build` | Compile TypeScript |
| `make start` | Run compiled app |
| `make test` | Run tests |
| `make test-coverage` | Run tests with coverage |
| `make lint` | Run ESLint |
| `make generate` | Generate Prisma client |
| `make migrate-dev` | Create/apply migrations (development) |
| `make migrate` | Apply migrations (production) |
| `make seed` | Seed database |
| `make clean` | Remove `dist/` and `coverage/` |

**Infrastructure & Docker**

| Command | Description |
|---------|-------------|
| `make infra-up` | Start Postgres, Redis, Elasticsearch, Kafka |
| `make infra-down` | Stop infrastructure containers |
| `make docker-up` | **One command:** `.env`, pull images, build, start infra, migrate, seed, start app |
| `make docker-down` | Stop full stack |
| `make docker-build` | Build products-service image |
| `make docker-migrate` | Apply migrations inside Docker |
| `make docker-seed` | Seed sample data inside Docker |
| `make docker-logs` | Tail products-service logs |
| `make docker-restart` | Rebuild and restart full stack |

### Quick Start (Docker)

One command — works on first run:

```bash
make docker-up
```

This will:
1. Create `.env` from `.env.example` if missing
2. Verify `PASSPORT_PUBLIC_KEY` is set in `.env`
3. Pull infrastructure images (Postgres, Redis, Elasticsearch, Kafka)
4. Build the products-service image
5. Start infrastructure and wait for PostgreSQL
6. Run database migrations and seed sample data
7. Start the products-service app

Before running, set your Auth Service public key in `.env`:

```env
PASSPORT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

Services:
- **HTTP API**: http://localhost:3001
- **Swagger Docs**: http://localhost:3001/api/docs
- **gRPC**: localhost:50051

### Local Development

```bash
make setup    # env, install, generate, infra-up, migrate-dev, seed
make dev
```

Or step by step:

```bash
make env install generate infra-up migrate-dev seed
make dev
```

## API Reference

All REST endpoints require `Authorization: Bearer <JWT>` (RS256 token from Auth Service).

### Public (any authenticated user)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List products (pagination: `page`, `limit`) |
| GET | `/api/v1/products/search?q=` | Search by name (Elasticsearch) |
| GET | `/api/v1/products/category/:categoryId` | Products by category |
| GET | `/api/v1/products/:id` | Get product by ID |
| GET | `/api/v1/categories` | List categories |
| GET | `/api/v1/categories/:id` | Get category by ID |

### Admin only (`role: ["admin"]`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/products` | Create product |
| PUT | `/api/v1/products/:id` | Update product |
| DELETE | `/api/v1/products/:id` | Delete product |
| POST | `/api/v1/categories` | Create category |
| PUT | `/api/v1/categories/:id` | Update category |
| DELETE | `/api/v1/categories/:id` | Delete category |

### gRPC Stock Service

Proto: `src/infrastructure/grpc/proto/stock.proto`

| RPC | Description |
|-----|-------------|
| `ReserveStock` | Reserve stock with TTL (default 15 min) |
| `GetStockAvailability` | Check total / reserved / available stock |

Example `ReserveStock` request:
```json
{
  "product_id": "uuid",
  "order_id": "order-123",
  "quantity": 2,
  "ttl_seconds": 900
}
```

### Kafka Events

**Topic**: `stock.release` (configurable via `KAFKA_STOCK_RELEASE_TOPIC`)

Release reserved stock when order is cancelled:
```json
{ "orderId": "order-123" }
```

Or by reservation ID:
```json
{ "orderId": "order-123", "reservationId": "uuid" }
```

## JWT Verification

Configure the Auth Service RSA public key:

```env
PASSPORT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

Verification steps (per Auth Service docs):
1. Algorithm must be **RS256**
2. Signature verified with public key
3. `exp` > now, `nbf` <= now
4. Extract `id`, `email`, `role[]` for authorization

## Database Schema

- **categories** — product categories
- **products** — catalog items with stock
- **reviews** — user product reviews (1–5 rating)
- **stock_reservations** — reserved stock with TTL and status (`ACTIVE`, `RELEASED`, `CONFIRMED`)

## Testing (TDD)

```bash
make test              # Run all tests
make test-watch        # Watch mode
make test-coverage     # Coverage report
```

Or with npm:

```bash
npm test
npm run test:watch
npm run test:coverage
```

Test structure:
- `tests/unit/` — domain entities, use cases, JWT verification
- `tests/integration/` — HTTP API with Supertest

## Security

- Helmet security headers
- Rate limiting (100 req/min default)
- JWT RS256 verification (no HS256)
- Admin role enforcement on write operations
- Input validation via use cases
- Non-root Docker container
- Swagger UI disabled in production by default (`SWAGGER_ENABLED=false` or `NODE_ENV=production`)

## Environment Variables

See [`.env.example`](.env.example) for full list.

| Variable | Description |
|----------|-------------|
| `SWAGGER_ENABLED` | Enable Swagger UI at `/api/docs`. Default: `true` in development, `false` when `NODE_ENV=production` |

**Production example:**

```env
NODE_ENV=production
SWAGGER_ENABLED=false
```

## License

MIT
