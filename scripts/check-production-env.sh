#!/usr/bin/env bash
# Validates .env for production — no Node.js required.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLACEHOLDER='YOUR_RSA_PUBLIC_KEY_HERE'
REQUIRED=(DATABASE_URL REDIS_URL PASSPORT_PUBLIC_KEY)

if [[ ! -f .env ]]; then
  if [[ ! -f .env.example ]]; then
    echo 'Missing .env and .env.example — cannot continue.' >&2
    exit 1
  fi
  cp .env.example .env
  if grep -q '^NODE_ENV=' .env; then
    sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' .env
  else
    echo 'NODE_ENV=production' >> .env
  fi
  if grep -q '^SWAGGER_ENABLED=' .env; then
    sed -i 's/^SWAGGER_ENABLED=.*/SWAGGER_ENABLED=false/' .env
  else
    echo 'SWAGGER_ENABLED=false' >> .env
  fi
  echo "Created .env from .env.example at: ${ROOT}/.env"
  echo 'Set production values (especially PASSPORT_PUBLIC_KEY), then run this script again.'
  echo "  nano ${ROOT}/.env"
  exit 1
fi

get_env() {
  local key="$1"
  local line value
  line=$(grep -E "^${key}=" .env | tail -n 1 | sed 's/\r$//' || true)
  if [[ -z "$line" ]]; then
    return 1
  fi
  value="${line#*=}"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  printf '%s' "$value"
}

failed=false

for key in "${REQUIRED[@]}"; do
  if ! value="$(get_env "$key")"; then
    echo "Missing required variable: ${key}" >&2
    failed=true
    continue
  fi
  if [[ -z "$value" ]]; then
    echo "Missing required variable: ${key}" >&2
    failed=true
  elif [[ "$key" == "PASSPORT_PUBLIC_KEY" && "$value" == *"$PLACEHOLDER"* ]]; then
    echo 'PASSPORT_PUBLIC_KEY still contains the placeholder — set your Auth Service RSA public key.' >&2
    failed=true
  fi
done

es_enabled="$(get_env ELASTICSEARCH_ENABLED || echo true)"
if [[ "$es_enabled" != "false" && "$es_enabled" != "0" ]]; then
  if ! es_node="$(get_env ELASTICSEARCH_NODE)" || [[ -z "$es_node" ]]; then
    echo 'Missing required variable: ELASTICSEARCH_NODE (or set ELASTICSEARCH_ENABLED=false)' >&2
    failed=true
  fi
fi

if [[ "$failed" == true ]]; then
  exit 1
fi

node_env="$(get_env NODE_ENV || true)"
if [[ "$node_env" != "production" ]]; then
  echo 'Warning: NODE_ENV is not "production" in .env — the start script will export NODE_ENV=production.'
fi

echo 'Production environment check passed.'
