import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS payments_stripe_payment_intents (
      payment_intent_id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      stripe_account_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payments_stripe_payment_intents_order_idx
    ON payments_stripe_payment_intents (order_id)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payments_stripe_payment_intents_stale_idx
    ON payments_stripe_payment_intents (status, created_at)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payments_stripe_payment_intents_location_idx
    ON payments_stripe_payment_intents (location_id, created_at)
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP TABLE IF EXISTS payments_stripe_payment_intents`.execute(db);
}
