# Admin Tenant Isolation Audit

Last verified: 2026-04-28

## Rule

Operator-admin routes must never trust a raw `locationId` for authorization. The gateway resolves the operator through identity, verifies the requested location is in the operator's authorized `locationIds`, and forwards the sanitized location context downstream.

For catalog and orders admin calls, the gateway forwards the selected location as `x-operator-location-id`. Downstream services scope reads and writes by that header. For staff-management calls, the gateway forwards only a sanitized `?locationId=` query to identity, never the raw inbound query string.

## Current Audit

| Route | Risk | Isolation behavior |
| --- | --- | --- |
| `GET /v1/admin/orders` | High | Requires `orders:read`; resolves location through authenticated operator context; forwards `x-operator-location-id` to orders. |
| `GET /v1/admin/orders/:orderId` | High | Requires `orders:read`; forwards `x-operator-location-id`; orders returns not found when the order is outside that location. |
| `POST /v1/admin/orders/:orderId/status` | High | Requires `orders:write`; forwards `x-operator-location-id`; orders rejects status changes for orders outside that location. |
| `GET /v1/admin/orders/stream` | High | Requires `orders:read`; initial snapshot and polling use `x-operator-location-id`; event-bus events are filtered by location before sending to the client. |
| `GET /v1/admin/menu` | Medium | Requires `menu:read`; forwards `x-operator-location-id` to catalog admin menu endpoint. |
| `GET /v1/admin/cards` | Medium | Requires `menu:read`; forwards `x-operator-location-id` to catalog admin cards endpoint. |
| `PUT /v1/admin/cards` | Medium | Requires `menu:write`; forwards `x-operator-location-id` to catalog before replacing cards. |
| `POST /v1/admin/cards` | Medium | Requires `menu:write`; forwards `x-operator-location-id` to catalog before creating a card. |
| `PUT /v1/admin/cards/:cardId` | Medium | Requires `menu:write`; forwards `x-operator-location-id`; catalog updates within that location. |
| `PATCH /v1/admin/cards/:cardId/visibility` | Medium | Requires `menu:visibility`; forwards `x-operator-location-id`; catalog updates visibility within that location. |
| `DELETE /v1/admin/cards/:cardId` | Medium | Requires `menu:write`; forwards `x-operator-location-id`; catalog deletes within that location. |
| `PUT /v1/admin/menu/:itemId` | Medium | Requires `menu:write`; forwards `x-operator-location-id`; catalog updates within that location. |
| `POST /v1/admin/menu/:itemId/image-upload` | Medium | Requires `menu:write`; forwards `x-operator-location-id`; catalog validates the item exists in that location before issuing upload URLs. |
| `POST /v1/admin/menu` | Medium | Requires `menu:write`; forwards `x-operator-location-id`; catalog creates the item in that location. |
| `PATCH /v1/admin/menu/:itemId/visibility` | Medium | Requires `menu:visibility`; forwards `x-operator-location-id`; catalog updates visibility within that location. |
| `DELETE /v1/admin/menu/:itemId` | Medium | Requires `menu:write`; forwards `x-operator-location-id`; catalog deletes within that location. |
| `GET /v1/admin/store/config` | Medium | Requires `store:read`; forwards `x-operator-location-id`; catalog reads config for that location. |
| `PUT /v1/admin/store/config` | Medium | Requires `store:write`; forwards `x-operator-location-id`; catalog updates config for that location. |
| `GET /v1/admin/staff` | Low | Requires `team:read`; gateway validates location against operator access and forwards only sanitized `?locationId=` to identity. |
| `POST /v1/admin/staff` | Medium | Requires `team:write`; gateway validates location against operator access and forwards only sanitized `?locationId=` to identity. |
| `PATCH /v1/admin/staff/:operatorUserId` | Medium | Requires `team:write`; gateway validates location against operator access and forwards only sanitized `?locationId=`; identity verifies the target operator belongs to that location before updating. |

## Test Coverage

Gateway tests cover:

- cross-tenant query override rejection before an orders upstream call is made
- cross-tenant order id read hiding through the downstream location header
- staff-route rejection for locations outside the operator access set
- downstream headers for order status mutation and cancellation

## Follow-Up

`#207` persists an active operator session location during password and Google sign-in. Multi-location operators may still select another accessible location with `?locationId=...`; that selection is only honored after the identity-provided access set authorizes it.
