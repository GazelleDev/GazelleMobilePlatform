import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`ALTER TABLE catalog_menu_categories ALTER COLUMN brand_id DROP DEFAULT`.execute(db);
  await sql`ALTER TABLE catalog_menu_items ALTER COLUMN brand_id DROP DEFAULT`.execute(db);
  await sql`ALTER TABLE catalog_home_news_cards ALTER COLUMN brand_id DROP DEFAULT`.execute(db);
  await sql`ALTER TABLE catalog_store_configs ALTER COLUMN brand_id DROP DEFAULT`.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`ALTER TABLE catalog_menu_categories ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'`.execute(db);
  await sql`ALTER TABLE catalog_menu_items ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'`.execute(db);
  await sql`ALTER TABLE catalog_home_news_cards ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'`.execute(db);
  await sql`ALTER TABLE catalog_store_configs ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'`.execute(db);
}
