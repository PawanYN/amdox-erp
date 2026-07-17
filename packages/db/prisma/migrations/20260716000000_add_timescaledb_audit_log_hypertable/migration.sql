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

-- migrate_data => true converts the existing table (and any rows already in
-- it) into a hypertable in place; if the table is already a hypertable this
-- is a no-op rather than an error, so this migration is safe to re-run.
SELECT create_hypertable('"AuditLog"', 'createdAt', if_not_exists => TRUE, migrate_data => TRUE);
