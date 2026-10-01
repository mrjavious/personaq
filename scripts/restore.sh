#!/bin/bash
# Persona Studio - Database Restore Script
# Usage: ./scripts/restore.sh <backup_file>

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will overwrite the current database!"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "Starting database restore..."
echo "Backup file: ${BACKUP_FILE}"

# Check if PostgreSQL or SQLite
if [[ "${DATABASE_URL}" == postgresql* ]]; then
  # PostgreSQL restore
  echo "Detected PostgreSQL database"
  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"
  else
    psql "${DATABASE_URL}" < "${BACKUP_FILE}"
  fi
elif [[ "${DATABASE_URL}" == file:* ]]; then
  # SQLite restore
  echo "Detected SQLite database"
  DB_PATH="${DATABASE_URL#file:}"
  if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}" > "${DB_PATH}"
  else
    cp "${BACKUP_FILE}" "${DB_PATH}"
  fi
else
  echo "Unknown database type: ${DATABASE_URL}"
  exit 1
fi

echo "Restore completed successfully!"
