# Admin Console Vercel Deployment

Last reviewed: `2026-04-29`

## Goal

Deploy `apps/admin-console` to Vercel with strict environment separation:

- preview deployments use `https://api-dev.nomly.us`
- production deployments use `https://api.nomly.us`

The admin console must never use one shared env payload for both preview and
production.

## Repo Target

- App: `apps/admin-console`
- Framework: Next.js
- Package: `@lattelink/admin-console`
- Vercel project: `lattelink-admin-console`

## GitHub Actions Secrets

The workflow in `.github/workflows/admin-console-vercel.yml` requires:

- `ADMIN_CONSOLE_VERCEL_TOKEN`
- `ADMIN_CONSOLE_VERCEL_ORG_ID`
- `ADMIN_CONSOLE_VERCEL_PROJECT_ID`
- `ADMIN_CONSOLE_VERCEL_PREVIEW_ENV`
- `ADMIN_CONSOLE_VERCEL_PRODUCTION_ENV`

Get `ADMIN_CONSOLE_VERCEL_ORG_ID` and `ADMIN_CONSOLE_VERCEL_PROJECT_ID` from
`apps/admin-console/.vercel/project.json`.

## Preview Env Payload

Store this as `ADMIN_CONSOLE_VERCEL_PREVIEW_ENV`:

```env
ADMIN_CONSOLE_SESSION_SECRET=<long-random-secret>
INTERNAL_ADMIN_API_BASE_URL=https://api-dev.nomly.us
ADMIN_CONSOLE_CLIENT_DASHBOARD_URL=https://dashboard-dev.nomly.us
SENTRY_ENVIRONMENT=preview
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

## Production Env Payload

Store this as `ADMIN_CONSOLE_VERCEL_PRODUCTION_ENV`:

```env
ADMIN_CONSOLE_SESSION_SECRET=<long-random-secret>
INTERNAL_ADMIN_API_BASE_URL=https://api.nomly.us
ADMIN_CONSOLE_CLIENT_DASHBOARD_URL=https://dashboard.nomly.us
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

Use different session secrets for preview and production.

## Validate

- `admin-dev.nomly.us` loads and calls `api-dev.nomly.us`
- `admin.nomly.us` loads and calls `api.nomly.us`
- support lookup works in both environments
- Sentry events from preview have `environment=preview`
- Sentry events from production have `environment=production`

