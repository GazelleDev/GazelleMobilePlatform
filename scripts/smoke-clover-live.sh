#!/usr/bin/env bash

set -euo pipefail

# Usage:
# - expects gateway to be running
# - expects live Clover env vars to be configured for the payments service
# - intended for manual sandbox/live validation, not CI

GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080}"
PAYMENTS_READY_URL="${GATEWAY_URL%/v1}/payments/ready"

echo "[smoke-clover-live] checking payments readiness at ${PAYMENTS_READY_URL}"
response="$(curl --silent --show-error --fail "${PAYMENTS_READY_URL}")"

if command -v jq >/dev/null 2>&1; then
  printf '%s\n' "${response}" | jq .
else
  printf '%s\n' "${response}"
fi

echo "[smoke-clover-live] real checkout is still required to validate live Clover charges end to end"
