#!/usr/bin/env bash

set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-gazelle-postgres}"
POSTGRES_USER="${POSTGRES_USER:-gazelle}"
POSTGRES_DB="${POSTGRES_DB:-gazelle}"
OUTPUT_PATH="${1:-backup-$(date +%Y%m%d-%H%M%S).dump}"

mkdir -p "$(dirname "${OUTPUT_PATH}")"

docker exec "${POSTGRES_CONTAINER}" \
  pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --compress=9 > "${OUTPUT_PATH}"

echo "Wrote Postgres backup to ${OUTPUT_PATH}"
