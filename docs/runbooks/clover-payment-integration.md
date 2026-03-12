# Clover Payment Integration Path

Last reviewed: `2026-03-11`

## Scope

M4.3 introduces Clover charge and refund paths across `orders` and `payments`:

- `payments`:
  - `POST /v1/payments/charges`
  - `POST /v1/payments/refunds`
- `orders`:
  - `POST /v1/orders/:orderId/pay` now calls payments charge endpoint
  - `POST /v1/orders/:orderId/cancel` triggers refund for paid orders

## Provider Modes

`payments` supports two Clover provider modes:

- `simulated` (default): deterministic local outcomes for development/testing
- `live`: real upstream Clover HTTP calls using configured endpoints and credentials

Live mode env:

- `CLOVER_PROVIDER_MODE=live`
- `CLOVER_API_KEY`
- `CLOVER_MERCHANT_ID`
- `CLOVER_CHARGE_ENDPOINT` (supports `{merchantId}` template)
- `CLOVER_REFUND_ENDPOINT` (supports `{merchantId}` and `{paymentId}` templates)
- `CLOVER_APPLE_PAY_TOKENIZE_ENDPOINT` (required when charging with `applePayWallet`)
- `CLOVER_WEBHOOK_SHARED_SECRET` (optional but strongly recommended)
- `ORDERS_SERVICE_BASE_URL` (defaults to `http://127.0.0.1:3001`)
- `ORDERS_INTERNAL_API_TOKEN` (set in both `payments` and `orders` to secure internal reconciliation calls)

### Sandbox endpoint baseline (validated)

For Clover sandbox ecommerce:

- `CLOVER_CHARGE_ENDPOINT=https://scl-sandbox.dev.clover.com/v1/charges`
- `CLOVER_REFUND_ENDPOINT=https://scl-sandbox.dev.clover.com/v1/refunds`
- `CLOVER_APPLE_PAY_TOKENIZE_ENDPOINT=https://token-sandbox.dev.clover.com/v1/tokens`

Token roles:

- `CLOVER_API_KEY` in service runtime should be the Clover private/ecommerce bearer token.
- Tokenization endpoint uses `apikey` header value from Clover `apiAccessKey` (public key), when calling directly.
- `CLOVER_MERCHANT_ID` must be Clover merchant UUID (for example from `GET /v3/merchants/current`), not external MID labels.

## Webhook Reconciliation

`payments` now accepts provider callbacks at:

- `POST /v1/payments/webhooks/clover`

On each webhook:

1. `payments` resolves the corresponding charge/refund from persisted state
2. updates persisted payment/refund status with provider outcome
3. dispatches internal reconciliation to:
   - `POST /v1/orders/internal/payments/reconcile`

`orders` then applies idempotent order transitions:

- `CHARGE: SUCCEEDED` -> transition `PENDING_PAYMENT` -> `PAID`
- `REFUND: REFUNDED` -> transition `PAID` -> `CANCELED`

Loyalty side effects are applied using existing idempotency keys, so duplicate webhook deliveries are safe.

## Charge Outcomes

`payments` simulates Clover outcomes based on payment payload content:

- `applePayToken` includes `decline` -> `DECLINED`
- `applePayToken` includes `timeout` -> `TIMEOUT`
- if using structured `applePayWallet`, its `data` value is used for the same simulation rules
- any other signal -> `SUCCEEDED`

`orders` maps these outcomes to API behavior:

- `SUCCEEDED` -> order transitions to `PAID`
- `DECLINED` -> `402` with `PAYMENT_DECLINED`
- `TIMEOUT` -> `504` with `PAYMENT_TIMEOUT`

## Refund Outcomes

When canceling a `PAID` order:

1. orders submits a refund request to payments
2. if refund status is `REFUNDED`, order transitions to `CANCELED`
3. if refund status is `REJECTED`, orders returns `409` with `REFUND_REJECTED`

For dev simulation, a cancel reason containing `reject` returns a rejected refund.

## Idempotency

- Charges are idempotent in payments by `orderId:idempotencyKey`.
- Refunds are idempotent in payments by `orderId:idempotencyKey`.
- Orders keeps pay idempotency per `orderId:idempotencyKey` for paid responses.
- Orders refund requests use `cancel:<orderId>:<reasonHashPrefix>` so identical cancel retries are idempotent while failed refund attempts can be retried with changed cancellation context.

## Verification

```bash
pnpm --filter @gazelle/payments lint
pnpm --filter @gazelle/payments typecheck
pnpm --filter @gazelle/payments test
pnpm --filter @gazelle/orders lint
pnpm --filter @gazelle/orders typecheck
pnpm --filter @gazelle/orders test
```
