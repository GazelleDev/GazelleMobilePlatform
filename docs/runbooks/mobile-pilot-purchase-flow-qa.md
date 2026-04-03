# Mobile Pilot Purchase Flow QA

Last updated: `2026-04-03`

## Purpose

Use this runbook to validate the customer mobile purchase flow before a pilot release or after any payment, menu, or order-tracking change.

This is the operational QA companion to:

- [test-full-flow-with-clover-connection.md](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/docs/issues/test-full-flow-with-clover-connection.md)
- [apple-pay-checkout.md](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/docs/runbooks/apple-pay-checkout.md)

## Required Inputs

- target environment URL
- mobile build/environment used
- test customer account
- Clover-connected store configuration
- one known-good payment scenario
- log access for gateway, orders, and payments

## Pass Criteria

The flow passes when all of the following are true:

- menu loads from the real environment
- cart totals and checkout inputs are coherent
- the launched payment path (`Clover card` or `Apple Pay`) succeeds or fails with a clear recovery path
- a paid order appears correctly in confirmation and Orders
- active-order and history rendering match backend truth
- obvious outage states do not masquerade as healthy UI

## Test Matrix

### 1. Session and Entry

- launch from a clean install or cleared session
- verify sign-in works
- verify return into menu/cart works after sign-in

### 2. Menu Browse

- verify menu loads from the target store
- verify store label and pickup estimate match environment config
- verify a temporary backend outage shows an unavailable state with retry instead of fallback placeholder content

### 3. Cart Behavior

- add one simple item
- add one customized item
- change quantity
- remove an item
- verify pricing updates stay coherent
- verify checkout disables cleanly if store/config data is unavailable

### 4. Payment Handoff

- start checkout from the cart
- if testing Apple Pay, verify Apple Pay opens with the expected total
- if testing Clover card checkout, verify the card section is visible for the signed-in user and Clover tokenization succeeds or fails with a clear inline message
- verify success clears the cart and lands on confirmation
- if safe to test, verify a failed payment leaves the user with a usable recovery path and does not surface an active unpaid order

### 5. Orders and Active Tracking

- verify the new order appears in Orders
- verify active order state is visible
- verify pickup code, totals, and status match backend data
- verify Orders retry affordance works if the order query fails

### 6. History and Loyalty

- verify the paid order moves into history when appropriate
- if loyalty is enabled, verify balances and ledger update correctly

## Failure States To Exercise

- menu/config outage
- order query outage
- payment failure before order creation
- payment failure after order creation
- expired session during browsing or checkout recovery

## Logging Template

Record one row per test run:

| Timestamp | Environment | Device | Account | Order ID | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `YYYY-MM-DD HH:MM` | `dev/pilot/prod` | `iPhone model + iOS` | `email` | `uuid or n/a` | `pass/fail` | `details` |

## Blocking Findings

Do not approve a pilot build if any of these occur:

- fallback menu/config content appears during a real backend outage
- checkout attempts against missing store configuration
- successful payment does not create a coherent confirmation/order history result
- order status in mobile disagrees with backend truth
- the app leaves the user in a dead end after auth or payment failure
