# LatteLink Dev Workflow

This document is the single source of truth for all development workflow decisions at LatteLink. It is written to be followed by both human developers and AI agents. Any repo rules, branch protection settings, commit hooks, or CI/CD configuration must align with this document. If there is a conflict between this document and any other file, this document wins.

---

## 1. Branches

There are exactly two persistent branches:

### `dev`

- This is the local working branch.
- All feature and fix branches are created from `dev`.
- `dev` does not deploy anywhere.
- `dev` should always be in a buildable state but is not required to be production-ready.

### `main`

- This is the production branch.
- Every push to `main` triggers an automatic deployment to the live environment.
- `main` must always be deployable.
- Direct commits to `main` are forbidden. The only way to update `main` is via a merge from `dev`.

---

## 2. Feature and Fix Branches

All work happens on short-lived branches created from `dev`.

### Naming convention

```text
<type>/<issue-number>-<short-description>
```

Types:

- `feat` - new feature or capability
- `fix` - bug fix
- `chore` - non-functional work such as dependency updates, config changes, cleanup
- `docs` - documentation only changes
- `refactor` - code restructuring with no behavior change
- `security` - security-related fixes or hardening

Examples:

```text
feat/42-clover-itemized-orders
fix/43-receipt-print-trigger
chore/44-remove-stale-env-vars
security/45-audit-exposed-secrets
```

### Rules

- Always branch from `dev`, never from `main`.
- Branch names must include the GitHub Issue number.
- Delete the branch after it is merged.
- Never leave a branch open longer than necessary. If work is paused, commit a `wip:` prefixed commit and push.

---

## 3. GitHub Issues

Every piece of work must have a GitHub Issue before any code is written. Issues are the single source of truth for what needs to be done and why.

### When to create an issue

Create an issue for:

- Every bug discovered during testing
- Every UI improvement or fix
- Every infrastructure or configuration task
- Every security concern
- Every architectural decision that requires implementation work
- Any "I don't know if this is a problem" item - create the issue, label it `investigate`

Do not start a branch without an issue. Do not fix something and then create the issue retroactively.

### Issue structure

Every issue must follow this template:

```markdown
## What

A single clear sentence describing what this issue is about.

## Why

Why this needs to be fixed or built. What breaks or degrades without it.

## Acceptance criteria

- [ ] Specific, testable condition that must be true for this issue to be closed
- [ ] Another condition
- [ ] Another condition

## Notes

Any relevant context, links, error messages, screenshots, or technical details.
Type: feat | fix | chore | docs | refactor | security | investigate
```

### Labels

Every issue must have exactly one type label:

- `feat`
- `fix`
- `chore`
- `docs`
- `refactor`
- `security`
- `investigate` - used when the problem is not yet understood

And exactly one priority label:

- `p0` - pilot blocker, must be resolved before Gazelle goes live
- `p1` - important but not blocking launch
- `p2` - post-launch or nice to have

### When to close an issue

An issue is closed when and only when all acceptance criteria are checked off and the fix has been merged to `main` and verified on the live environment. Closing an issue before deployment is forbidden. Closing an issue because "it seems fixed" without verification is forbidden.

---

## 4. Commits

All commits must follow the Conventional Commits specification.

### Format

```text
<type>(<scope>): <short description> #<issue-number>
```

- Type must be one of: `feat`, `fix`, `chore`, `docs`, `refactor`, `security`, `wip`
- Scope is the service or area affected: `orders`, `payments`, `catalog`, `auth`, `ui`, `db`, `infra`, `deps`
- Short description is lowercase, present tense, no period at the end
- Issue number must always be included

### Examples

```text
feat(orders): send itemized line items to clover #42
fix(payments): handle declined card state in checkout flow #43
chore(infra): remove unused env vars from docker compose #44
security(auth): remove hardcoded service credentials #45
docs(runbooks): update clover sandbox setup steps #46
refactor(catalog): extract menu sync logic into dedicated service #47
wip(orders): partial receipt print integration #42
```

### Rules

- Never commit directly to `dev` or `main`.
- Every commit must reference an issue number.
- `wip:` commits are allowed but must be squashed or followed by a clean commit before merging.
- Commit messages must be meaningful. "fix bug", "update", "changes" are not acceptable.
- One logical change per commit. Do not bundle unrelated changes in a single commit.

---

## 5. Pull Requests

Every merge requires a pull request, even when working solo. The PR is the record of what changed and why.

### PR types

There are two types of PRs:

**Feature PR** - merges a feature or fix branch into `dev`
**Release PR** - merges `dev` into `main`

### Feature PR template

```markdown
## Summary

What this PR does in one or two sentences.

## Issue

Closes #<issue-number>

## Changes

- List of specific changes made

## Testing

How this was tested. What was verified on the live environment.

## Notes

Anything the reviewer (future you or an AI agent) should know.
```

### Release PR template

```markdown
## Release summary

What is included in this release.

## Issues closed

- Closes #42
- Closes #43

## Changes included

- feat(orders): send itemized line items to clover
- fix(payments): handle declined card state in checkout flow

## Pre-merge checklist

- [ ] All included issues have acceptance criteria met
- [ ] Tested on live environment
- [ ] No dev info or secrets exposed in UI or logs
- [ ] No console errors in critical flows
```

### Merge rules

- Feature branches merge into `dev` using squash merge to keep history clean.
- `dev` merges into `main` using a regular merge commit so the release is clearly marked in history.
- Never force push to `dev` or `main`.
- Never merge a PR with failing CI checks.

---

## 6. Deployment

Deployment is automatic and triggered only by pushes to `main`.

### Flow

1. Push or merge to `main`
2. GitHub Actions builds and publishes Docker images to GHCR tagged with the full git SHA
3. GitHub Actions deploys to the DigitalOcean droplet using the SHA tag
4. Services restart via PM2 or Docker on the droplet

### Image tagging

Images must always be tagged with the full git SHA. Never use `latest` as the only tag. The deploy step must reference `${{ github.sha }}` directly - never read from a stored environment variable.

```yaml
env:
  IMAGE_TAG: ${{ github.sha }}
```

### Manual redeploy

The deployment action must include a `workflow_dispatch` trigger so any previous release can be redeployed manually from the GitHub UI without a code change.

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      image_tag:
        description: "Git SHA to deploy (leave empty for latest main)"
        required: false
```

### Path filtering

Path-based filtering that skips image publishing is allowed only for files that cannot affect runtime behavior, such as markdown files, non-service config, and documentation. Any change to source code, environment config, Dockerfiles, or dependency files must trigger a full build and publish.

---

## 7. Versioning

Versioning is applied only at release time on `main`. Individual commits, pushes to `dev`, and feature branch merges are not versioned.

### Scheme

LatteLink uses semantic versioning: `vMAJOR.MINOR.PATCH`

- `PATCH` - bug fixes with no new functionality: `v0.1.1`
- `MINOR` - new features or meaningful changes: `v0.2.0`
- `MAJOR` - the first stable production launch: `v1.0.0`

### Current state

Everything before Gazelle goes live is `v0.x.x`. The day Gazelle goes live is `v1.0.0`.

### How to tag a release

After merging `dev` into `main`:

```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```

### Changelog

A `CHANGELOG.md` file lives at the root of the repo. It is updated at every release with the following format:

```markdown
## v1.0.0 - 2026-04-15

### Added

- Itemized order line items sent to Clover on order creation

### Fixed

- Receipt print trigger on incoming orders
- Declined card state handled correctly in checkout

### Security

- Removed hardcoded service credentials
- Audited and reduced env var surface area
```

Only `main` version tags get changelog entries. Pre-release `v0.x.x` entries are optional but recommended.

---

## 8. Rollback

To roll back to a previous release:

1. Go to GitHub Actions
2. Select the deployment workflow
3. Click "Run workflow"
4. Enter the git SHA of the last known good release
5. Run

The deployment action will pull and deploy that specific image tag. No code changes or reverts required.

To find the SHA of a previous release:

```bash
git log --oneline main
```

Or check the release tags:

```bash
git tag --sort=-creatordate
```

---

## 9. Docs

### What to document

Only document things that currently exist and are stable. Do not document planned features, future architecture, or aspirational states.

### Folder structure

```text
docs/
  adr/               # Architecture decision records
  architecture/      # Current system architecture only
  runbooks/          # Operational how-tos that are accurate today
  api-contracts.md   # Current API surface
CHANGELOG.md         # Release history
```

### Rules

- If a doc describes something that has changed, update it immediately or delete it.
- Stale documentation is worse than no documentation.
- Architecture docs must not be written until the architecture is stable. The multi-tenant redesign docs are written after the pilot, not before.
- ADRs are append-only. Never edit a past ADR. Add a new one that supersedes it.

### ADR format

```markdown
# ADR-XXXX: Title

## Date

YYYY-MM-DD

## Status

Accepted | Superseded by ADR-XXXX

## Context

What situation or problem led to this decision.

## Decision

What was decided.

## Consequences

What becomes easier or harder as a result of this decision.
```

---

## 10. AI Agent Instructions

This section is written specifically for AI agents operating on this repository.

### Branch rules

- Never commit directly to `main` or `dev`.
- Always create a branch from `dev` using the naming convention in section 2.
- Always include the GitHub Issue number in the branch name and every commit message.

### Before writing any code

- Check if a GitHub Issue exists for the task. If not, create one following the template in section 3.
- Read the acceptance criteria before starting. Do not do work that is not covered by the acceptance criteria without creating a new issue.

### Commits

- Follow the commit format in section 4 exactly.
- Never produce a commit without an issue reference.
- Never bundle unrelated changes in a single commit.

### Pull requests

- Always open a PR using the appropriate template in section 5.
- Never merge your own PR without explicit instruction.
- Never merge to `main` directly. Only merge feature branches to `dev`.

### Secrets and environment variables

- Never hardcode secrets, API keys, or credentials in source code.
- Never log secrets or sensitive values.
- If a secret is found hardcoded in the codebase, create a `security` issue immediately before touching anything else.

### When something is unclear

- Do not guess. Create an `investigate` issue documenting what is unclear and stop.
- Do not make architectural decisions without explicit instruction. Flag the decision needed and wait.

### What never to touch without explicit instruction

- Docker and deployment configuration
- GitHub Actions workflows
- Database migrations
- Any file in `docs/adr/`
- `CHANGELOG.md`
- Branch protection rules
