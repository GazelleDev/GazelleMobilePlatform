import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_menu_categories
    ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_menu_items
    ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_home_news_cards
    ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_store_configs
    ALTER COLUMN brand_id SET DEFAULT 'rawaqcoffee'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_store_configs
    ALTER COLUMN store_name SET DEFAULT 'Rawaq Coffee Flagship'
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE catalog_store_configs
    ALTER COLUMN store_name SET DEFAULT 'Gazelle Coffee Flagship'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_store_configs
    ALTER COLUMN brand_id SET DEFAULT 'gazelle-default'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_home_news_cards
    ALTER COLUMN brand_id SET DEFAULT 'gazelle-default'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_menu_items
    ALTER COLUMN brand_id SET DEFAULT 'gazelle-default'
  `.execute(db);

  await sql`
    ALTER TABLE catalog_menu_categories
    ALTER COLUMN brand_id SET DEFAULT 'gazelle-default'
  `.execute(db);
}
