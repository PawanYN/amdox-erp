-- Enable TimescaleDB and convert AuditLog into a hypertable.
--
-- WHY: AuditLog is exactly the shape TimescaleDB is for — append-only,
-- timestamped (createdAt), high-volume, and already indexed on
-- (tenantId, createdAt) for time-range queries. This is purely additive:
-- all existing columns, indexes, and queries against "AuditLog" continue
-- to work unchanged; TimescaleDB partitions the table internally by time.
--
-- Requires the Postgres image to have the timescaledb extension available
-- (see infra/docker/docker-compose.yml — api-db / api-db-replica now use
-- a TimescaleDB-on-Postgres-17 image instead of plain postgres:17-alpine).
--
-- GOTCHA for anyone with an EXISTING local dev Postgres volume from before
-- this change: the TimescaleDB image only auto-configures
-- `shared_preload_libraries = 'timescaledb'` in postgresql.conf on first-time
-- initdb of a fresh volume. If you're reusing an old volume (docker-compose
-- didn't recreate it), CREATE EXTENSION will fail with "extension timescaledb
-- must be preloaded" until you add that line to postgresql.conf yourself and
-- restart the container once:
--   docker exec amdox-postgres bash -c "echo \"shared_preload_libraries = 'timescaledb'\" >> /var/lib/postgresql/data/postgresql.conf"
--   docker restart amdox-postgres
-- Anyone starting from a fresh `docker compose up` volume never hits this.

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- TimescaleDB requires every unique constraint on a hypertable to include
-- the partitioning column, so the old single-column `id` primary key has to
-- become a composite (id, createdAt) key before create_hypertable will
-- accept the table. `id` (uuid()) stays effectively unique in practice.
-- Guarded so this migration is safe to re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuditLog_pkey'
      AND conkey = ARRAY(
        SELECT attnum FROM pg_attribute
        WHERE attrelid = '"AuditLog"'::regclass
          AND attname IN ('id', 'createdAt')
        ORDER BY attnum
      )
  ) THEN
    ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_pkey";
    ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id, "createdAt");
  END IF;
END $$;

-- migrate_data => true converts the existing table (and any rows already in
-- it) into a hypertable in place; if the table is already a hypertable this
-- is a no-op rather than an error, so this migration is safe to re-run.
SELECT create_hypertable('"AuditLog"', 'createdAt', if_not_exists => TRUE, migrate_data => TRUE);
