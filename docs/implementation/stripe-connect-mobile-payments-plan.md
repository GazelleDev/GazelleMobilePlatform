# Stripe Connect Mobile Payments Plan

Last updated: `2026-04-21`

## Goal

Make `Stripe Connect Express` the only customer payment rail for all mobile ordering clients, while preserving `Clover` as an optional POS/menu integration only.

Target outcome:

- every client uses Stripe for mobile card and Apple Pay checkout
- each coffee shop is its own Stripe merchant through Connect Express
- the platform does not mirror tender or payment state into Clover
- Clover remains optional for menu sync and operational order submission
- order state becomes `PAID` only after verified Stripe webhook reconciliation

## Locked Decisions

- Mobile payments are `Stripe only`.
- Each coffee shop is its own Stripe merchant via `Stripe Connect Express`.
- The platform takes no per-transaction application fee.
- Platform revenue comes from separate monthly subscription billing.
- Scope is `mobile only` for now.
- Scope is `US / USD only`.
- Tenants get linked out to Stripe Express for payout and dispute visibility.
- Clover may remain enabled for POS/menu/order operations.
- Payment mirroring into Clover is explicitly out of scope.

## Non-Negotiable Security Boundary

`Stripe webhook signature verification is required from day one.`

This is the security boundary between:

- Stripe confirming a payment event, and
- `orders` transitioning an order from `PENDING_PAYMENT` to `PAID`

Do not ship any phase where:

- webhook signatures are skipped
- webhook signatures are stubbed
- raw webhook JSON is trusted without Stripe signature validation
- order finalization depends only on the client saying PaymentSheet succeeded

The initial implementation must:

- verify the Stripe signature against the raw request body
- reject unsigned or invalidly signed webhook deliveries
- treat webhook verification failure as a hard failure, not a warning
- cover this behavior with tests before enabling the integration for real tenants

## Product Model

Separate two concepts clearly per location:

- `customer payment rail`
- `store operational integration`

For this product direction:

- customer payment rail is always `Stripe`
- store operational integration may be `Clover` or `none`

This means Clover should no longer be modeled as a payment provider in runtime config, contracts, or order/payment persistence.

## Current Repo Seams

Primary implementation surfaces already in place:

- `packages/contracts/orders/src/index.ts`
- `packages/contracts/catalog/src/index.ts`
- `packages/persistence/src/index.ts`
- `packages/sdk-mobile/src/index.ts`
- `services/orders/src/service.ts`
- `services/orders/src/routes.ts`
- `services/orders/test/payments-e2e.test.ts`
- `services/payments/src/routes.ts`
- `services/payments/src/adapters/clover.ts`
- `services/payments/test/health.test.ts`
- `services/catalog/src/repository.ts`
- `services/catalog/src/routes.ts`
- `services/catalog/src/tenant.ts`
- `services/gateway/src/routes.ts`
- `apps/mobile/src/api/client.ts`
- `apps/mobile/src/orders/checkout.ts`
- `apps/mobile/app/checkout.tsx`
- `apps/admin-console/src/app/actions.ts`

Current architectural constraint:

- payments, orders, contracts, and persistence are still Clover-shaped even though the future payment model is Stripe-only

## Desired End State

### Payments

- `payments` is Stripe-first
- mobile checkout uses `Stripe PaymentSheet`
- each location has a Stripe Connect profile
- refunds run through Stripe
- Stripe webhooks are the source of truth for payment confirmation

### Orders

- orders are created before payment confirmation
- orders remain `PENDING_PAYMENT` until verified Stripe reconciliation
- only verified Stripe events can transition orders to `PAID`
- paid orders can then be submitted to Clover as operational tickets if the location uses Clover

### Clover

- Clover is optional and operational only
- Clover may own menu sync or order/ticket ingestion
- Clover does not own customer payment truth
- Clover does not receive mirrored payment/tender state

## Data Model

Introduce a new concept:

- `ClientPaymentProfile`

Suggested fields:

- `locationId`
- `stripeAccountId`
- `stripeAccountType`
- `stripeOnboardingStatus`
- `stripeDetailsSubmitted`
- `stripeChargesEnabled`
- `stripePayoutsEnabled`
- `stripeDashboardEnabled`
- `country`
- `currency`
- `cardEnabled`
- `applePayEnabled`
- `refundsEnabled`
- `cloverPosEnabled`
- `createdAt`
- `updatedAt`

Suggested defaults:

- `stripeAccountType = express`
- `country = US`
- `currency = USD`
- `cardEnabled = true`
- `applePayEnabled = true`
- `refundsEnabled = true`

Computed values:

- payment readiness
- onboarding readiness
- checkout availability
- missing required Stripe account state

## Runtime Config Direction

Refactor runtime `app-config` so payment capability data becomes Stripe-centered.

Current `paymentCapabilities` in `packages/contracts/catalog/src/index.ts` is Clover-shaped and should move toward:

- `paymentCapabilities.card`
- `paymentCapabilities.applePay`
- `paymentCapabilities.refunds`
- `paymentCapabilities.stripe.enabled`
- `paymentCapabilities.stripe.onboarded`
- `paymentCapabilities.stripe.dashboardEnabled`

Keep Clover configuration separate under operational integrations, not customer payments.

## Order And Payment Flow

### Stripe Checkout Flow

1. Mobile loads `GET /v1/app-config`.
2. Mobile confirms Stripe checkout is enabled for the location.
3. Mobile creates quote and internal order.
4. Order is persisted as `PENDING_PAYMENT`.
5. Mobile requests a Stripe mobile checkout session from backend.
6. Backend creates a Stripe PaymentIntent on the connected account and returns PaymentSheet configuration.
7. Mobile presents PaymentSheet.
8. Stripe sends a signed webhook event.
9. `payments` verifies the webhook signature and reconciles the event.
10. `orders` transitions the order to `PAID` only after verified reconciliation.
11. If Clover POS is enabled, submit the paid order to Clover as an operational order only.

### Operational Clover Rule

For locations with Clover POS enabled:

- submit item/customization/order details after Stripe payment succeeds
- do not mirror tender/payment into Clover
- do not wait on Clover to declare the customer paid
- Stripe remains the payment source of truth

## Contract Changes

### Orders Contracts

Refactor away from Clover token fields in:

- `packages/contracts/orders/src/index.ts`

Current shape:

- `paymentSourceToken`
- `applePayToken`
- `applePayWallet`

Target direction:

- replace token-passing payment confirmation with Stripe mobile session creation and Stripe webhook reconciliation
- keep order creation and refund concepts explicit
- remove hardcoded `provider: "CLOVER"` assumptions from order-facing payment models

### Catalog Contracts

Extend:

- `packages/contracts/catalog/src/index.ts`

Add:

- `clientPaymentProfileSchema`
- `internalLocationPaymentProfileUpdateSchema`
- `paymentReadinessSchema`

Include `paymentProfile` on internal location summary responses when appropriate.

## Persistence Changes

Extend:

- `packages/persistence/src/index.ts`

Add storage for:

- per-location Stripe payment profile
- generic payment records with Stripe identifiers
- generic refund records with Stripe identifiers
- webhook deduplication entries for Stripe events

Current payment persistence uses Clover-specific provider literals and should be generalized or rewritten around Stripe as the only active customer payment provider.

Add migrations under:

- `packages/persistence/src/migrations`

## Internal Admin API

Add:

- `GET /v1/internal/locations/:locationId/payment-profile`
- `PUT /v1/internal/locations/:locationId/payment-profile`
- `POST /v1/internal/locations/:locationId/stripe/onboarding-link`
- `POST /v1/internal/locations/:locationId/stripe/dashboard-link`

Requirements:

- internal admin can see readiness and onboarding state per client
- internal admin can store or refresh Stripe account linkage
- tenant-facing payout/dispute visibility happens through Stripe Express links, not custom dashboard surfaces

## Payments Service Plan

Refactor:

- `services/payments/src/routes.ts`

Add Stripe-first endpoints:

- `POST /v1/payments/stripe/mobile-session`
- `POST /v1/payments/stripe/refunds`
- `POST /v1/payments/stripe/connect/onboarding-link`
- `POST /v1/payments/stripe/connect/dashboard-link`
- `POST /v1/payments/webhooks/stripe`

Implementation requirements:

- PaymentIntent creation on the connected account
- PaymentSheet-friendly response payloads for mobile
- refund execution through Stripe
- webhook signature verification against raw body
- webhook idempotency
- reconciliation dispatch into `orders`

The webhook route must be implemented with raw-body access in mind so Stripe signature verification is correct.

## Orders Service Plan

Refactor:

- `services/orders/src/service.ts`
- `services/orders/src/routes.ts`

Target behavior:

- create order before payment completion
- keep order in `PENDING_PAYMENT` until verified Stripe reconciliation
- apply idempotent `PAID` transitions from internal reconciliation events
- support refund-driven order cancellation where applicable
- optionally submit paid orders to Clover operationally after payment confirmation

Do not let the mobile client directly set order payment success.

## Mobile App Plan

Replace current Clover-specific checkout path in:

- `apps/mobile/app/checkout.tsx`
- `apps/mobile/src/orders/checkout.ts`
- `apps/mobile/src/api/client.ts`

Target behavior:

- remove Clover card-entry UI and tokenization path
- integrate Stripe React Native SDK and PaymentSheet
- request backend-created PaymentSheet config
- show processing state until server-side reconciliation resolves the order state
- use runtime app-config to gate checkout availability

Apple Pay should flow through Stripe PaymentSheet, not a parallel Clover payment path.

## Admin Console Plan

Extend:

- `apps/admin-console/src/app/actions.ts`
- client management routes under `apps/admin-console/src/app/(console)/clients`

Add a payment management section that supports:

- viewing Stripe onboarding status
- requesting onboarding links
- requesting Stripe Express dashboard links
- viewing payment readiness blockers
- toggling whether Clover POS integration is enabled operationally

Do not build embedded financial reporting UI.

## Phase Sequence

## Phase 0: Lock The Architecture

- Stripe is the only mobile payment rail
- Clover is operational only
- payment mirroring into Clover is prohibited
- webhook signature verification is a day-one requirement

Acceptance criteria:

- engineering docs and contracts reflect Stripe-only customer payments
- no new Clover payment work is added after this plan is adopted

## Phase 1: Contracts, Persistence, And Security Boundary

- add `ClientPaymentProfile`
- refactor Clover-shaped payment contracts
- generalize or replace Clover-specific payment persistence
- implement raw-body Stripe webhook signature verification path first

Acceptance criteria:

- Stripe webhook route verifies signatures against raw body
- invalid signatures are rejected
- tests cover valid and invalid signature handling
- internal payment profile model exists per location

## Phase 2: Stripe Connect Account Management

- add Stripe Connect Express account linkage per location
- add onboarding link and dashboard link flows
- surface readiness in internal admin APIs

Acceptance criteria:

- each client can be linked to a Stripe account
- readiness reflects `charges_enabled` and `payouts_enabled`
- admin can open onboarding and dashboard links per location

## Phase 3: Stripe Charge And Refund Path

- add mobile session endpoint for PaymentSheet
- create PaymentIntents on connected accounts
- add refund route and persistence
- reconcile Stripe webhook outcomes into orders

Acceptance criteria:

- mobile session works for a connected account
- verified payment success marks order `PAID`
- refund flow works through Stripe
- duplicate webhooks are safe

## Phase 4: Mobile Checkout Migration

- integrate Stripe React Native SDK
- replace Clover card entry and Clover tokenization
- route all mobile checkout through PaymentSheet

Acceptance criteria:

- no custom card form remains in the mobile app
- Apple Pay uses Stripe PaymentSheet
- mobile checkout no longer depends on Clover payment config

## Phase 5: Clover Operational Coexistence

- submit paid orders into Clover where enabled
- keep Clover payment-independent
- handle operational submission retries separately from payment confirmation

Acceptance criteria:

- paid Stripe orders can still appear in Clover-backed store operations
- Clover submission failure does not invalidate Stripe payment truth

## Phase 6: Cleanup

- remove Clover mobile payment routes
- remove Clover tokenization settings from customer payment flows
- update runbooks and tests

Acceptance criteria:

- no runtime customer payment path depends on Clover
- docs and env expectations are Stripe-first

## File Targets By Area

### Contracts And Persistence

- `packages/contracts/orders/src/index.ts`
- `packages/contracts/catalog/src/index.ts`
- `packages/persistence/src/index.ts`
- `packages/persistence/src/migrations/*`

### Payments

- `services/payments/src/routes.ts`
- `services/payments/test/health.test.ts`
- new Stripe helper modules under `services/payments/src`

### Orders

- `services/orders/src/service.ts`
- `services/orders/src/routes.ts`
- `services/orders/test/payments-e2e.test.ts`

### Catalog And Admin

- `services/catalog/src/repository.ts`
- `services/catalog/src/routes.ts`
- `services/catalog/src/tenant.ts`
- `apps/admin-console/src/app/actions.ts`
- client management routes and forms under `apps/admin-console`

### Mobile

- `apps/mobile/app/checkout.tsx`
- `apps/mobile/src/orders/checkout.ts`
- `apps/mobile/src/api/client.ts`
- any Stripe SDK setup files added under `apps/mobile`

### Gateway

- `services/gateway/src/routes.ts`
- `services/gateway/test/gateway.test.ts`

## Testing Requirements

Required before rollout:

- signature verification tests for Stripe webhooks
- raw-body webhook handling tests
- payment reconciliation idempotency tests
- connected-account PaymentIntent creation tests
- refund reconciliation tests
- mobile checkout happy-path tests
- admin onboarding link flow tests
- Clover operational submission coexistence tests where applicable

## Acceptance Criteria

- every client can onboard to Stripe Connect Express
- mobile checkout uses Stripe PaymentSheet only
- orders become `PAID` only from verified Stripe webhook reconciliation
- invalid Stripe webhook signatures cannot mutate order state
- refunds run through Stripe and reconcile correctly
- Clover remains optional for operations only
- no payment/tender mirroring into Clover exists anywhere in the platform
- no custom card-entry flow remains in mobile checkout

## Explicit Non-Goals

- supporting Clover as a customer payment provider
- building in-product payout or dispute reporting dashboards
- supporting non-US countries or non-USD currencies
- web checkout
- tender/payment mirroring into Clover

## Final Note

The integration should be judged successful only when the security boundary is correct:

- PaymentSheet can say payment completed on-device
- but the platform must still wait for a verified Stripe webhook before treating the order as paid

That rule should not be relaxed in early implementation phases.
