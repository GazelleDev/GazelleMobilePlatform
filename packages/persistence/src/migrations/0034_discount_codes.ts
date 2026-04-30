import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS discount_codes (
      discount_code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      location_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('percent', 'fixed_cents')),
      value INTEGER NOT NULL,
      max_discount_cents INTEGER,
      min_subtotal_cents INTEGER NOT NULL DEFAULT 0,
      eligibility TEXT NOT NULL DEFAULT 'everyone'
        CHECK (eligibility IN ('everyone', 'first_order_only', 'existing_customers_only')),
      once_per_customer BOOLEAN NOT NULL DEFAULT FALSE,
      max_total_redemptions INTEGER,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      starts_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (location_id, code)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS discount_codes_location_active_idx
    ON discount_codes (location_id, active)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS discount_codes_location_code_idx
    ON discount_codes (location_id, code)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS discount_code_redemptions (
      redemption_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      discount_code_id UUID NOT NULL REFERENCES discount_codes (discount_code_id),
      location_id TEXT NOT NULL,
      code TEXT NOT NULL,
      order_id UUID NOT NULL,
      user_id UUID NOT NULL,
      discount_cents INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('RESERVED', 'REDEEMED', 'RELEASED')),
      reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      redeemed_at TIMESTAMPTZ,
      released_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_id),
      UNIQUE (discount_code_id, user_id, order_id)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS discount_redemptions_code_status_idx
    ON discount_code_redemptions (discount_code_id, status)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS discount_redemptions_user_code_status_idx
    ON discount_code_redemptions (user_id, discount_code_id, status)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS discount_redemptions_location_status_idx
    ON discount_code_redemptions (location_id, status)
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP INDEX IF EXISTS discount_redemptions_location_status_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS discount_redemptions_user_code_status_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS discount_redemptions_code_status_idx`.execute(db);
  await sql`DROP TABLE IF EXISTS discount_code_redemptions`.execute(db);
  await sql`DROP INDEX IF EXISTS discount_codes_location_code_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS discount_codes_location_active_idx`.execute(db);
  await sql`DROP TABLE IF EXISTS discount_codes`.execute(db);
}
