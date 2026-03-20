import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_store_configs
    ADD COLUMN IF NOT EXISTS store_name TEXT NOT NULL DEFAULT 'Gazelle Coffee Flagship'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_store_configs
    ADD COLUMN IF NOT EXISTS hours_text TEXT NOT NULL DEFAULT 'Daily · 7:00 AM - 6:00 PM'
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS catalog_app_configs (
      brand_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      app_config_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (brand_id, location_id)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS catalog_app_configs_location_idx
    ON catalog_app_configs (location_id, brand_id)
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP TABLE IF EXISTS catalog_app_configs`.execute(db);

  await sql`
    ALTER TABLE catalog_store_configs
    DROP COLUMN IF EXISTS hours_text
  `.execute(db);

  await sql`
    ALTER TABLE catalog_store_configs
    DROP COLUMN IF EXISTS store_name
  `.execute(db);
}
