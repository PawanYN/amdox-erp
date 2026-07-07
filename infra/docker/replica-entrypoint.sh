#!/bin/sh
# Takes a base backup from the primary (api-db) on first start, then hands
# off to the normal postgres entrypoint. `-R` (pg_basebackup) writes
# standby.signal + primary_conninfo into postgresql.auto.conf automatically,
# so no manual recovery config is needed — this container starts as a
# streaming replica the moment the base backup finishes.
set -e

if [ -z "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
  echo "[replica-entrypoint] Empty data directory — taking a base backup from primary ($PRIMARY_HOST)..."
  until PGPASSWORD="$REPLICATION_PASSWORD" pg_basebackup \
      -h "$PRIMARY_HOST" -p "${PRIMARY_PORT:-5432}" \
      -U "$REPLICATION_USER" \
      -D "$PGDATA" -Fp -Xs -P -R
  do
    echo "[replica-entrypoint] Primary not ready yet, retrying in 2s..."
    sleep 2
  done
  chmod 0700 "$PGDATA"
  echo "[replica-entrypoint] Base backup complete — standby.signal + primary_conninfo written by -R."
else
  echo "[replica-entrypoint] Data directory already populated — skipping base backup."
fi

exec docker-entrypoint.sh postgres
