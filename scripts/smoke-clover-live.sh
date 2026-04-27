#!/usr/bin/env bash

set -euo pipefail

# Usage:
# - expects the payments service to be running in Clover live mode
# - uses PAYMENTS_URL, not the gateway URL
# - intended for manual sandbox verification only, not CI

PAYMENTS_URL="${PAYMENTS_URL:-http://127.0.0.1:3003}"
HEALTH_URL="${PAYMENTS_URL%/}/health"
READY_URL="${PAYMENTS_URL%/}/ready"

print_response() {
  local label="$1"
  local url="$2"
  local body_file
  body_file="$(mktemp)"

  local status
  status="$(curl --silent --show-error --output "${body_file}" --write-out "%{http_code}" "${url}")"

  echo "[smoke-clover-live] ${label} ${url} -> HTTP ${status}"
  if command -v jq >/dev/null 2>&1; then
    jq . "${body_file}" 2>/dev/null || cat "${body_file}"
  else
    cat "${body_file}"
  fi
  rm -f "${body_file}"
  echo
}

print_response "health" "${HEALTH_URL}"
print_response "ready" "${READY_URL}"

echo "[smoke-clover-live] readiness is only a preflight"
echo "[smoke-clover-live] Clover is now an optional POS bridge only"
echo "[smoke-clover-live] use /v1/payments/clover/oauth/connect to verify the OAuth bridge when needed"
