#!/usr/bin/env bash

set -euo pipefail

cat >&2 <<'EOF'
[test-clover-live-charge] deprecated

Clover is no longer used for client payment processing.
All customer payments must go through Stripe.

The remaining Clover integration is an optional POS bridge:
- verify readiness with `scripts/smoke-clover-live.sh`
- connect OAuth with `GET /v1/payments/clover/oauth/connect`
- validate downstream order mirroring through `POST /v1/payments/orders/submit`
EOF

exit 1
