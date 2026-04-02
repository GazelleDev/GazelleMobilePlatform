#!/usr/bin/env bash

set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-gazelle-postgres}"
POSTGRES_USER="${POSTGRES_USER:-gazelle}"
RESTORE_DB="${2:-gazelle_restore_verify}"
BACKUP_PATH="${1:?usage: restore-postgres-scratch.sh <backup-path> [scratch-db-name]}"

if [[ ! -f "${BACKUP_PATH}" ]]; then
  echo "Backup file not found: ${BACKUP_PATH}" >&2
  exit 1
fi

if [[ ! "${RESTORE_DB}" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "Invalid scratch database name: ${RESTORE_DB}" >&2
  exit 1
fi

docker exec "${POSTGRES_CONTAINER}" \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS \"${RESTORE_DB}\";"

docker exec "${POSTGRES_CONTAINER}" \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d postgres \
  -c "CREATE DATABASE \"${RESTORE_DB}\";"

cat "${BACKUP_PATH}" | docker exec -i "${POSTGRES_CONTAINER}" \
  pg_restore \
  -U "${POSTGRES_USER}" \
  -d "${RESTORE_DB}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges

echo "Restored ${BACKUP_PATH} into scratch database ${RESTORE_DB}"
