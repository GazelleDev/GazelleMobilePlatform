#!/usr/bin/env bash

set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-gazelle-postgres}"
POSTGRES_USER="${POSTGRES_USER:-gazelle}"
TARGET_DB="${1:-gazelle_restore_verify}"

if [[ ! "${TARGET_DB}" =~ ^[a-zA-Z0-9_]+$ ]]; then
  echo "Invalid database name: ${TARGET_DB}" >&2
  exit 1
fi

applied_migrations="$(docker exec "${POSTGRES_CONTAINER}" \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${TARGET_DB}" -tA \
  -c "SELECT COUNT(*) FROM kysely_migration;")"

if [[ "${applied_migrations}" -le 0 ]]; then
  echo "No applied migrations found in ${TARGET_DB}" >&2
  exit 1
fi

echo "Applied migrations: ${applied_migrations}"
echo "Pilot entity counts:"

docker exec "${POSTGRES_CONTAINER}" \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER}" -d "${TARGET_DB}" \
  -P pager=off -F $'\t' -A \
  -c "
    SELECT 'identity_users' AS entity, COUNT(*)::bigint AS row_count FROM identity_users
    UNION ALL
    SELECT 'operator_users' AS entity, COUNT(*)::bigint AS row_count FROM operator_users
    UNION ALL
    SELECT 'orders' AS entity, COUNT(*)::bigint AS row_count FROM orders
    UNION ALL
    SELECT 'catalog_menu_categories' AS entity, COUNT(*)::bigint AS row_count FROM catalog_menu_categories
    UNION ALL
    SELECT 'catalog_menu_items' AS entity, COUNT(*)::bigint AS row_count FROM catalog_menu_items
    UNION ALL
    SELECT 'catalog_store_configs' AS entity, COUNT(*)::bigint AS row_count FROM catalog_store_configs
    ORDER BY entity;
  "

echo "Restore verification completed for ${TARGET_DB}"
