#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="${1:-./backups/gazelle-${TIMESTAMP}.dump}"
SCRATCH_DB="${2:-gazelle_restore_verify}"

mkdir -p "$(dirname "${BACKUP_PATH}")"

"${SCRIPT_DIR}/backup-postgres.sh" "${BACKUP_PATH}"
"${SCRIPT_DIR}/restore-postgres-scratch.sh" "${BACKUP_PATH}" "${SCRATCH_DB}"
"${SCRIPT_DIR}/verify-postgres-restore.sh" "${SCRATCH_DB}"

echo "Backup + scratch restore rehearsal completed successfully"
