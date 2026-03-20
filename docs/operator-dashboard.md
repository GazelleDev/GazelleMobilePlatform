# Operator Dashboard

Last updated: `2026-03-20`

## Purpose

The staff dashboard is an internal web app for store operators. It is intentionally separate from the customer Expo app and uses a browser-local operator session before any operational data is shown.

## App Location

The current MVP lives in:

- [`apps/operator-web`](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/apps/operator-web)

It is a lightweight Vite-powered browser app that talks to the gateway admin routes. The operator app is now the only repo-owned staff UI target.

## Entry Flow

Operators provide:

- API base URL
- staff token

The browser stores those values in `localStorage` so the console can reconnect on refresh without mixing staff state into the customer mobile app.

## Backend Surface

The operator web app uses these gateway routes:

- `GET /v1/app-config`
- `GET /v1/admin/orders`
- `GET /v1/admin/orders/:orderId`
- `POST /v1/admin/orders/:orderId/status`
- `GET /v1/admin/menu`
- `PUT /v1/admin/menu/:itemId`
- `GET /v1/admin/store/config`
- `PUT /v1/admin/store/config`

## Assumed Request Shapes

These are the current operator-web request bodies:

- order status update body: `{ status: "IN_PREP" | "READY" | "COMPLETED" | "CANCELED", note?: string }`
- menu update body: `{ name: string, priceCents: number, visible: boolean }`
- store config update body: `{ storeName: string, hours: string, pickupInstructions: string }`

The staff token is sent as both:

- `x-staff-token: <token>`
- `Authorization: Bearer <token>`

That gives the backend flexibility while keeping the entry flow explicit.

## MVP Capabilities

- active order list with selected-order detail in a browser layout
- staff actions for prep, ready, complete, and cancel
- item name, price, and visibility edits
- store name, hours, and pickup-instructions edits
- runtime app-config visibility for brand and feature flags

## Deployment Notes

- `pnpm --filter @gazelle/operator-web dev` runs the operator app locally.
- `pnpm --filter @gazelle/operator-web build` emits the static build.
- The app can be hosted as an internal-only static site as long as it can reach the gateway base URL.

## Operating Notes

- The dashboard treats order status as canonical and expects timeline entries to be append-only.
- Cancel is surfaced through the existing refund-aware order cancel path, not the lifecycle-only transition writer.
- Manual order status controls are only available when runtime fulfillment mode is `staff`.
- When runtime fulfillment mode is `time_based`, the operator dashboard remains available for visibility and catalog/store updates, but order progression controls are disabled.
- The current auth model is a pragmatic stopgap: gateway staff token plus bearer-shaped header presence.
- The surface should be treated as operational tooling, not customer UI.
