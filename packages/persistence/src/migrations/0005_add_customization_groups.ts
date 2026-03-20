import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_menu_items
    ADD COLUMN IF NOT EXISTS customization_groups_json JSONB NOT NULL DEFAULT '[]'::jsonb
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_menu_items
    DROP COLUMN IF EXISTS customization_groups_json
  `.execute(db);
}
