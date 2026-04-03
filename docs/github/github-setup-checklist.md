# GitHub Setup Checklist

Last reviewed: `2026-04-03`

The authoritative workflow policy for this repo lives in [development-flow.md](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/docs/runbooks/development-flow.md). Use this checklist only to configure GitHub so it matches that policy.

## Repository

- [x] default branch: `main`
- [x] allow merge commits
- [x] allow squash merges
- [x] disable rebase merges
- [x] delete head branches on merge

GitHub applies merge-method availability repo-wide, not per target branch. To match the workflow policy, enable both merge commits and squash merges, then follow the policy operationally:

- feature PRs into `dev` use squash merge
- release PRs from `dev` into `main` use a regular merge commit

## Labels

Required type labels:

- [x] `feat`
- [x] `fix`
- [x] `chore`
- [x] `docs`
- [x] `refactor`
- [x] `security`
- [x] `investigate`

Required priority labels:

- [x] `p0`
- [x] `p1`
- [x] `p2`

## Branch Protection

### `main`

- [x] require pull requests
- [x] block direct pushes
- [x] block force pushes
- [x] block branch deletion
- [x] require conversation resolution
- [x] do not require linear history
- [x] require these checks:
  - `validate-pr`
  - `validate-commits`
  - `lint`
  - `typecheck`
  - `unit-tests`
  - `contract-tests`
  - `build`
  - `terraform-validate`
  - `codeql`
  - `dependency-review`
  - `secret-scan`
- [x] only allow `dev -> main` release PRs
      GitHub branch protection cannot express this directly, so this is enforced by `validate-dev-workflow`.

### `dev`

- [x] require pull requests
- [x] block direct pushes
- [x] block force pushes
- [x] block branch deletion
- [x] require conversation resolution
- [x] require these checks:
  - `validate-pr`
  - `validate-commits`
  - `lint`
  - `typecheck`
  - `unit-tests`
  - `contract-tests`
  - `build`
  - `terraform-validate`
  - `codeql`
  - `dependency-review`
  - `secret-scan`

## Actions Workflows

- [x] `publish-free-images` runs on every `main` push and tags images with the full git SHA
- [x] `deploy-free` runs after successful image publish on `main`
- [x] `deploy-free` supports manual `workflow_dispatch` redeploys using a full git SHA
- [x] there is no workflow that deploys `dev`
- [x] there is no workflow that promotes `staging` or `prod` outside the `main` deploy flow

## Variables

- [ ] `FREE_API_DOMAIN`
- [ ] `FREE_DEPLOY_PATH`
- [ ] `FREE_IMAGE_REGISTRY_PREFIX`
- [ ] `FREE_PASSKEY_RP_ID`
- [ ] `FREE_CORS_ALLOWED_ORIGINS`
- [ ] `FREE_CLIENT_DASHBOARD_DOMAIN`
- [ ] `FREE_GOOGLE_OAUTH_ALLOWED_REDIRECT_URIS`
- [ ] `FREE_PAYMENTS_PROVIDER_MODE`
- [ ] `FREE_CLOVER_OAUTH_ENVIRONMENT`
- [ ] `FREE_CLOVER_CHARGE_ENDPOINT`
- [ ] `FREE_CLOVER_REFUND_ENDPOINT`
- [ ] `FREE_CLOVER_APPLE_PAY_TOKENIZE_ENDPOINT`

## Secrets

- [ ] `FREE_DEPLOY_HOST`
- [ ] `FREE_DEPLOY_USER`
- [ ] `FREE_DEPLOY_SSH_KEY`
- [ ] `FREE_DATABASE_URL` or `FREE_POSTGRES_PASSWORD`
- [ ] `FREE_GATEWAY_INTERNAL_API_TOKEN`
- [ ] `FREE_ORDERS_INTERNAL_API_TOKEN`
- [ ] `FREE_LOYALTY_INTERNAL_API_TOKEN`
- [ ] `FREE_NOTIFICATIONS_INTERNAL_API_TOKEN`
- [ ] `FREE_JWT_SECRET`
- [ ] `LETSENCRYPT_EMAIL`
- [ ] `FREE_GOOGLE_OAUTH_CLIENT_ID`
- [ ] `FREE_GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] `FREE_GOOGLE_OAUTH_STATE_SECRET`
- [ ] `FREE_CLOVER_BEARER_TOKEN`
- [ ] `FREE_CLOVER_API_KEY`
- [ ] `FREE_CLOVER_API_ACCESS_KEY`
- [ ] `FREE_CLOVER_MERCHANT_ID`
- [ ] `FREE_CLOVER_APP_ID`
- [ ] `FREE_CLOVER_APP_SECRET`
- [ ] `FREE_CLOVER_OAUTH_REDIRECT_URI`
- [ ] `FREE_CLOVER_OAUTH_STATE_SECRET`
- [ ] `FREE_CLOVER_WEBHOOK_SHARED_SECRET`
- [ ] `CLIENT_DASHBOARD_VERCEL_TOKEN`
- [ ] `CLIENT_DASHBOARD_VERCEL_ORG_ID`
- [ ] `CLIENT_DASHBOARD_VERCEL_PROJECT_ID`
- [ ] `CLIENT_DASHBOARD_VERCEL_ENV`
- [ ] `GHCR_USERNAME` if GHCR images are private
- [ ] `GHCR_TOKEN` if GHCR images are private
