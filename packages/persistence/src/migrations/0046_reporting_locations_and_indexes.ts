import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

/**
 * Existing deployments have historically operated on the Detroit store-hours
 * default. This backfill is deliberately a migration default only: new
 * reporting resolves each location's stored IANA timezone and never reads it
 * from a process-wide reporting setting.
 */
export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_client_locations
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Detroit'
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payments_charges_reporting_success_idx
    ON payments_charges (occurred_at, order_id)
    WHERE status = 'SUCCEEDED' AND approved = TRUE
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payments_refunds_reporting_success_idx
    ON payments_refunds (occurred_at, order_id)
    WHERE status = 'REFUNDED'
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS orders_reporting_location_idx
    ON orders ((order_json ->> 'locationId'))
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP INDEX IF EXISTS orders_reporting_location_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS payments_refunds_reporting_success_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS payments_charges_reporting_success_idx`.execute(db);
  await sql`ALTER TABLE catalog_client_locations DROP COLUMN IF EXISTS timezone`.execute(db);
}
