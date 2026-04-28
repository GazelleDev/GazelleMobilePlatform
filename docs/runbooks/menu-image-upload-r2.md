# Menu Image Uploads With Cloudflare R2

Last reviewed: `2026-04-28`

This runbook validates the merchant menu-image upload path used by the client dashboard.

## Runtime Path

1. Client dashboard requests `POST /v1/admin/menu/:itemId/image-upload`.
2. Gateway proxies to catalog `POST /v1/catalog/admin/menu/:itemId/image-upload`.
3. Catalog creates presigned Cloudflare R2 `PUT` URLs for the original image and mobile variants.
4. Client dashboard uploads the original file and generated variants directly to R2.
5. Client dashboard saves the returned original `assetUrl` to the menu item.
6. Mobile and dashboard render `menu.items[].imageUrl` from catalog.

## Required GitHub Environment Vars

Configure these separately in `dev` and `production`:

- `CATALOG_MEDIA_R2_ACCOUNT_ID`
- `CATALOG_MEDIA_R2_BUCKET`
- `CATALOG_MEDIA_PUBLIC_BASE_URL`
- `CATALOG_MEDIA_UPLOAD_MAX_BYTES`
- `CATALOG_MEDIA_UPLOAD_EXPIRY_SECONDS`

Recommended defaults:

- `CATALOG_MEDIA_UPLOAD_MAX_BYTES=10485760`
- `CATALOG_MEDIA_UPLOAD_EXPIRY_SECONDS=300`

## Required GitHub Environment Secrets

Configure these separately in `dev` and `production`:

- `CATALOG_MEDIA_R2_ACCESS_KEY_ID`
- `CATALOG_MEDIA_R2_SECRET_ACCESS_KEY`

Use separate R2 API tokens for `dev` and `production`. The token only needs object read/write access for the configured bucket.

## R2 Bucket Requirements

- Public reads must work through `CATALOG_MEDIA_PUBLIC_BASE_URL`.
- Browser `PUT` uploads must be allowed from the dashboard origin.
- CORS must allow `PUT`, `GET`, and `HEAD`.
- CORS must allow the `content-type` header.
- CORS should allow the exact dashboard origins, not `*`, for production.

Example CORS policy:

```json
[
  {
    "AllowedOrigins": ["https://app-dev.nomly.us", "https://app.nomly.us"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3000
  }
]
```

## Validation

Run this in `dev` before enabling merchant uploads in production:

1. Confirm `/ready` is healthy on the API domain.
2. Open the client dashboard for the same environment.
3. Select a real location and menu item.
4. Upload a JPG or PNG smaller than `CATALOG_MEDIA_UPLOAD_MAX_BYTES`.
5. Confirm the dashboard preview renders the saved image.
6. Confirm the mobile app menu renders the same saved image.
7. In Cloudflare R2, confirm these objects exist under the same timestamped stem:
   - `original/*.jpg|png|webp|heic|heif`
   - `mobile-list/*.jpg`
   - `mobile-hero/*.jpg`

## Expected Failure Behavior

- Missing R2 config returns `503 MENU_IMAGE_UPLOAD_UNAVAILABLE`.
- Unsupported content type returns `400 INVALID_MENU_IMAGE_UPLOAD`.
- Oversized upload returns `413 INVALID_MENU_IMAGE_UPLOAD`.
- Failed browser upload shows `Unable to upload image.` or `Image upload failed (<status>).`

## Notes

The catalog service normalizes public object extensions from the declared content type, not the uploaded filename. This prevents misleading public URLs such as an image uploaded as `coffee.php`.
