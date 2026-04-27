# API Contracts: First Cut

## Base URL

`https://api.gazellecoffee.com/v1`

## Auth

- `POST /auth/apple/exchange`
- `POST /auth/passkey/register/challenge`
- `POST /auth/passkey/register/verify`
- `POST /auth/passkey/auth/challenge`
- `POST /auth/passkey/auth/verify`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`

## Catalog

- `GET /menu`
- `GET /store/config`

## Orders

- `POST /orders/quote`
- `POST /orders`
- `GET /orders`
- `GET /orders/{orderId}`
- `POST /orders/{orderId}/cancel`

## Loyalty

- `GET /loyalty/balance`
- `GET /loyalty/ledger`

## Notifications

- `PUT /devices/push-token`
