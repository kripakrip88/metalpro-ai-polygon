#!/usr/bin/env bash
# PostgreSQL backup — run inside postgres container or on host with pg_dump available
# Usage: ./scripts/backup.sh
# Env: DATABASE_URL, BACKUP_DIR (default ./backups), BACKUP_KEEP_DAYS (default 7)
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/metaldb_${TIMESTAMP}.dump"

pg_dump \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges \
  "${DATABASE_URL:-postgresql://metaluser:metalpass@localhost:5433/metaldb}" \
  --file="$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Created: $BACKUP_FILE ($SIZE)"

find "$BACKUP_DIR" -name "metaldb_*.dump" -mtime +"${KEEP_DAYS}" -delete
REMAINING=$(find "$BACKUP_DIR" -name "metaldb_*.dump" | wc -l | tr -d ' ')
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Retained backups: $REMAINING (cleanup threshold: ${KEEP_DAYS}d)"
