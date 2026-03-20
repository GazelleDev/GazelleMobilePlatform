import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS payments_webhook_deduplication (
      event_key TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      order_id UUID NOT NULL,
      payment_id UUID NOT NULL,
      status TEXT NOT NULL,
      order_applied BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP TABLE IF EXISTS payments_webhook_deduplication`.execute(db);
}
