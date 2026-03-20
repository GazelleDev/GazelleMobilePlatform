#!/usr/bin/env bash

set -euo pipefail

# Manual Clover sandbox charge helper.
# - expects the payments service to be running with CLOVER_PROVIDER_MODE=live
# - uses PAYMENTS_URL directly, not the gateway URL
# - requires APPLE_PAY_TOKEN to be exported before running
# - intended for manual sandbox verification only, not CI

PAYMENTS_URL="${PAYMENTS_URL:-http://127.0.0.1:3003}"
APPLE_PAY_TOKEN="${APPLE_PAY_TOKEN:?Set APPLE_PAY_TOKEN to a Clover sandbox Apple Pay token before running this script.}"
AMOUNT_CENTS="${AMOUNT_CENTS:-825}"
CURRENCY="${CURRENCY:-USD}"

generate_uuid() {
  node -e 'console.log(require("node:crypto").randomUUID())'
}

ORDER_ID="${ORDER_ID:-$(generate_uuid)}"
REQUEST_ID="${REQUEST_ID:-$(generate_uuid)}"
IDEMPOTENCY_KEY="${IDEMPOTENCY_KEY:-clover-live-$(date +%s)-${REQUEST_ID##*-}}"
CHARGE_URL="${PAYMENTS_URL%/}/v1/payments/charges"

payload="$(cat <<EOF
{
  "orderId": "${ORDER_ID}",
  "amountCents": ${AMOUNT_CENTS},
  "currency": "${CURRENCY}",
  "applePayToken": "${APPLE_PAY_TOKEN}",
  "idempotencyKey": "${IDEMPOTENCY_KEY}"
}
EOF
)"

response_file="$(mktemp)"
cleanup() {
  rm -f "${response_file}"
}
trap cleanup EXIT

echo "[test-clover-live-charge] POST ${CHARGE_URL}"
echo "[test-clover-live-charge] orderId=${ORDER_ID}"
echo "[test-clover-live-charge] idempotencyKey=${IDEMPOTENCY_KEY}"
echo

http_status="$(
  curl \
    --silent \
    --show-error \
    --output "${response_file}" \
    --write-out "%{http_code}" \
    --request POST \
    --header "content-type: application/json" \
    --header "x-request-id: ${REQUEST_ID}" \
    --data "${payload}" \
    "${CHARGE_URL}"
)"

echo "[test-clover-live-charge] HTTP ${http_status}"
if command -v jq >/dev/null 2>&1; then
  jq . "${response_file}" 2>/dev/null || cat "${response_file}"
else
  cat "${response_file}"
fi
