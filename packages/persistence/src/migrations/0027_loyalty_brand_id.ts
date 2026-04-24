import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`ALTER TABLE loyalty_balances ADD COLUMN IF NOT EXISTS brand_id TEXT NOT NULL DEFAULT 'rawaqcoffee'`.execute(db);
  await sql`ALTER TABLE loyalty_ledger_entries ADD COLUMN IF NOT EXISTS brand_id TEXT NOT NULL DEFAULT 'rawaqcoffee'`.execute(db);
  await sql`ALTER TABLE loyalty_idempotency_keys ADD COLUMN IF NOT EXISTS brand_id TEXT NOT NULL DEFAULT 'rawaqcoffee'`.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS loyalty_balances_brand_user_idx
    ON loyalty_balances (brand_id, user_id)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS loyalty_ledger_entries_brand_user_idx
    ON loyalty_ledger_entries (brand_id, user_id)
  `.execute(db);
  await sql`
    CREATE INDEX IF NOT EXISTS loyalty_idempotency_keys_brand_user_idx
    ON loyalty_idempotency_keys (brand_id, user_id)
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP INDEX IF EXISTS loyalty_balances_brand_user_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS loyalty_ledger_entries_brand_user_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS loyalty_idempotency_keys_brand_user_idx`.execute(db);
  await sql`ALTER TABLE loyalty_balances DROP COLUMN IF EXISTS brand_id`.execute(db);
  await sql`ALTER TABLE loyalty_ledger_entries DROP COLUMN IF EXISTS brand_id`.execute(db);
  await sql`ALTER TABLE loyalty_idempotency_keys DROP COLUMN IF EXISTS brand_id`.execute(db);
}
