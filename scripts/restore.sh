#!/usr/bin/env bash
# Restore PostgreSQL backup
# Usage: ./scripts/restore.sh <backup-file.dump>
# Env: DATABASE_URL
set -euo pipefail

BACKUP_FILE="${1:?Usage: restore.sh <backup-file.dump>}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restoring from: $BACKUP_FILE"

pg_restore \
  --format=custom \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --dbname="${DATABASE_URL:-postgresql://metaluser:metalpass@localhost:5433/metaldb}" \
  "$BACKUP_FILE"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restore complete"
