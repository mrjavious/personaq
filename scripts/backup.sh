#!/bin/bash
# Persona Studio - Database Backup Script
# Usage: ./scripts/backup.sh [backup_dir]

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/personaq_backup_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "Starting database backup..."
echo "Backup file: ${BACKUP_FILE}"

# Check if PostgreSQL or SQLite
if [[ "${DATABASE_URL}" == postgresql* ]]; then
  # PostgreSQL backup
  echo "Detected PostgreSQL database"
  pg_dump "${DATABASE_URL}" > "${BACKUP_FILE}"
elif [[ "${DATABASE_URL}" == file:* ]]; then
  # SQLite backup
  echo "Detected SQLite database"
  DB_PATH="${DATABASE_URL#file:}"
  cp "${DB_PATH}" "${BACKUP_FILE}.sqlite"
  BACKUP_FILE="${BACKUP_FILE}.sqlite"
else
  echo "Unknown database type: ${DATABASE_URL}"
  exit 1
fi

# Compress backup
echo "Compressing backup..."
gzip "${BACKUP_FILE}"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Clean up old backups (keep last 7 days)
echo "Cleaning up old backups..."
find "${BACKUP_DIR}" -name "personaq_backup_*.gz" -mtime +7 -delete

echo "Backup completed successfully: ${BACKUP_FILE}"
echo "Backup size: $(du -h "${BACKUP_FILE}" | cut -f1)"
