# Release Runbook

The authoritative release and deployment workflow for this repo lives in [development-flow.md](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/docs/runbooks/development-flow.md).

Current release flow:

1. Merge `dev` into `main` with a regular merge commit.
2. Let the `main` push publish full-SHA images and deploy automatically.
3. Verify the live environment.
4. Tag the release on `main`.
5. Update [CHANGELOG.md](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/CHANGELOG.md).

Rollback uses the deployment workflow `workflow_dispatch` path with a previous full git SHA.

If this file ever conflicts with [development-flow.md](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/docs/runbooks/development-flow.md), [development-flow.md](/Users/yazan/Documents/Gazelle/Dev/GazelleMobilePlatform/docs/runbooks/development-flow.md) wins.
