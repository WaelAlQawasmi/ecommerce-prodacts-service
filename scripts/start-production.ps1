# Production startup — Docker full stack (default) or local Node (-Local).
# Usage:
#   .\scripts\start-production.ps1
#   .\scripts\start-production.ps1 -Local
#   .\scripts\start-production.ps1 -Seed

param(
    [switch]$Local,
    [switch]$Seed,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

if ($Help) {
    Write-Host @"
Usage: .\scripts\start-production.ps1 [-Local] [-Seed]

  -Local  Run on the host with Node (no Docker app container)
  -Seed    Seed sample data (Docker mode only; not recommended for real prod)
"@
    exit 0
}

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$env:NODE_ENV = "production"
# Do not override SWAGGER_ENABLED — use value from .env

Write-Host "==> Production environment check..."
& "$Root\scripts\check-production-env.ps1"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Local) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js 20+ is required for -Local mode. Install Node or run without -Local (Docker mode)."
    }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "npm is required for -Local mode."
    }

    Write-Host "==> Installing production dependencies..."
    npm ci --omit=dev

    Write-Host "==> Generating Prisma client..."
    npx prisma generate

    Write-Host "==> Building application..."
    npm run build

    Write-Host "==> Applying database migrations..."
    npm run migrate

    Write-Host "==> Starting products-service (NODE_ENV=production)..."
    npm start
    exit $LASTEXITCODE
}

$DockerCompose = if ($env:DOCKER_COMPOSE) { $env:DOCKER_COMPOSE } else { "docker compose" }

Write-Host "==> Pulling infrastructure images..."
Invoke-Expression "$DockerCompose pull postgres redis elasticsearch kafka"

Write-Host "==> Building products-service image (NODE_ENV=production)..."
Invoke-Expression "$DockerCompose build --build-arg NODE_ENV=production products-service"

Write-Host "==> Starting infrastructure (Postgres, Redis, Elasticsearch, Kafka)..."
Invoke-Expression "$DockerCompose up -d postgres redis elasticsearch kafka"

Write-Host "==> Waiting for PostgreSQL..."
do {
    Start-Sleep -Seconds 2
    Invoke-Expression "$DockerCompose exec -T postgres pg_isready -U products -d products_db" | Out-Null
} while ($LASTEXITCODE -ne 0)

Write-Host "==> Applying database migrations..."
Invoke-Expression @"
$DockerCompose run --rm --no-deps `
  -e DATABASE_URL=postgresql://products:products_secret@postgres:5432/products_db?schema=public `
  products-service npx prisma migrate deploy
"@
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Seed) {
    Write-Host "==> Seeding database..."
    Invoke-Expression @"
$DockerCompose run --rm --no-deps `
  -e DATABASE_URL=postgresql://products:products_secret@postgres:5432/products_db?schema=public `
  products-service sh -c "npx tsx prisma/seed.ts"
"@
}

Write-Host "==> Starting products-service..."
Invoke-Expression "$DockerCompose up -d products-service"

$Port = if ($env:PORT) { $env:PORT } else { "3001" }
$GrpcPort = if ($env:GRPC_PORT) { $env:GRPC_PORT } else { "50051" }

$swaggerStatus = "disabled (default for NODE_ENV=production)"
if (Test-Path ".env") {
    $swaggerLine = Select-String -Path ".env" -Pattern "^SWAGGER_ENABLED=(true|1)" | Select-Object -Last 1
    if ($swaggerLine) {
        $swaggerStatus = "enabled at http://localhost:$Port/api/docs"
    }
}

Write-Host ""
Write-Host "Production stack is running."
Write-Host "  HTTP API:  http://localhost:$Port"
Write-Host "  gRPC:      localhost:$GrpcPort"
Write-Host "  Swagger:   $swaggerStatus"
Write-Host ""
Write-Host "Logs: $DockerCompose logs -f products-service"
