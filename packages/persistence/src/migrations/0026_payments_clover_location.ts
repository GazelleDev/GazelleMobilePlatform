import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`ALTER TABLE payments_clover_connections ADD COLUMN IF NOT EXISTS location_id TEXT`.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS payments_clover_connections_location_idx
    ON payments_clover_connections (location_id)
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP INDEX IF EXISTS payments_clover_connections_location_idx`.execute(db);
  await sql`ALTER TABLE payments_clover_connections DROP COLUMN IF EXISTS location_id`.execute(db);
}
