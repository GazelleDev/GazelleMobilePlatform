# Orders Lifecycle and Idempotency

Last reviewed: `2026-03-10`

## Scope

`services/orders` now implements:
- `POST /v1/orders/quote`
- `POST /v1/orders`
- `POST /v1/orders/:orderId/pay`
- `GET /v1/orders`
- `GET /v1/orders/:orderId`
- `POST /v1/orders/:orderId/cancel`

## Lifecycle

Default in-memory flow:

1. Quote is created with computed subtotal/discount/tax/total and a `quoteHash`.
2. Order is created from `quoteId + quoteHash` in `PENDING_PAYMENT`.
3. Payment transitions order to `PAID`.
4. Cancel transitions order to `CANCELED` (unless already canceled/completed).
5. `timeline` is appended on lifecycle transitions.

## Idempotency Controls

- Create idempotency key:
  - derived from `quoteId:quoteHash`
  - repeated creates for the same pair return the same order
- Payment idempotency key:
  - derived from `orderId:idempotencyKey`
  - repeated payments with the same key return the same paid response

## Gateway Routing

`services/gateway` order routes now proxy to the orders service (`ORDERS_SERVICE_BASE_URL`).

Default:
- `ORDERS_SERVICE_BASE_URL=http://127.0.0.1:3001`

## Verification

```bash
pnpm --filter @gazelle/orders lint
pnpm --filter @gazelle/orders typecheck
pnpm --filter @gazelle/orders test
pnpm --filter @gazelle/gateway lint
pnpm --filter @gazelle/gateway typecheck
pnpm --filter @gazelle/gateway test
```
