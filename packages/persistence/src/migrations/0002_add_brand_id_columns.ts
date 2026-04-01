import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_menu_categories
    ADD COLUMN IF NOT EXISTS brand_id TEXT NOT NULL DEFAULT 'gazelle-default'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_menu_items
    ADD COLUMN IF NOT EXISTS brand_id TEXT NOT NULL DEFAULT 'gazelle-default'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_store_configs
    ADD COLUMN IF NOT EXISTS brand_id TEXT NOT NULL DEFAULT 'gazelle-default'
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_store_configs
    DROP COLUMN IF EXISTS brand_id
  `.execute(db);

  await sql`
    ALTER TABLE catalog_menu_items
    DROP COLUMN IF EXISTS brand_id
  `.execute(db);

  await sql`
    ALTER TABLE catalog_menu_categories
    DROP COLUMN IF EXISTS brand_id
  `.execute(db);
}
