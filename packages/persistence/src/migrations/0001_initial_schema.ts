import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS payments_charges (
      payment_id UUID PRIMARY KEY,
      provider_payment_id TEXT,
      order_id UUID NOT NULL,
      idempotency_key TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      approved BOOLEAN NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      decline_code TEXT,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_id, idempotency_key)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payments_charges_order_created_at_idx
    ON payments_charges (order_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS payments_refunds (
      refund_id UUID PRIMARY KEY,
      order_id UUID NOT NULL,
      payment_id UUID NOT NULL,
      idempotency_key TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_id, idempotency_key)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS payments_refunds_order_created_at_idx
    ON payments_refunds (order_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_balances (
      user_id UUID PRIMARY KEY,
      available_points INTEGER NOT NULL,
      pending_points INTEGER NOT NULL,
      lifetime_earned INTEGER NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_ledger_entries (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      type TEXT NOT NULL,
      points INTEGER NOT NULL,
      order_id UUID,
      created_at TIMESTAMPTZ NOT NULL
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS loyalty_ledger_entries_user_created_at_idx
    ON loyalty_ledger_entries (user_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS loyalty_idempotency_keys (
      user_id UUID NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_fingerprint TEXT NOT NULL,
      response_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, idempotency_key)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS orders_quotes (
      quote_id UUID PRIMARY KEY,
      quote_hash TEXT NOT NULL,
      quote_json JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      order_id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      quote_id UUID NOT NULL REFERENCES orders_quotes (quote_id),
      order_json JSONB NOT NULL,
      payment_id UUID,
      successful_charge_json JSONB,
      successful_refund_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS orders_created_at_idx
    ON orders (created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS orders_create_idempotency (
      quote_id UUID NOT NULL,
      quote_hash TEXT NOT NULL,
      order_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (quote_id, quote_hash)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS orders_payment_idempotency (
      order_id UUID NOT NULL,
      idempotency_key TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (order_id, idempotency_key)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS identity_sessions (
      access_token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL UNIQUE,
      user_id UUID NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      auth_method TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS identity_sessions_user_idx
    ON identity_sessions (user_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS identity_passkey_challenges (
      challenge TEXT PRIMARY KEY,
      flow TEXT NOT NULL,
      user_id UUID,
      rp_id TEXT NOT NULL,
      timeout_ms INTEGER NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS identity_passkey_challenges_flow_idx
    ON identity_passkey_challenges (flow, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS identity_passkey_credentials (
      credential_id TEXT PRIMARY KEY,
      user_id UUID NOT NULL,
      webauthn_user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL,
      transports_json JSONB NOT NULL,
      device_type TEXT NOT NULL,
      backed_up BOOLEAN NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS identity_passkey_credentials_user_idx
    ON identity_passkey_credentials (user_id, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS notifications_push_tokens (
      user_id UUID NOT NULL,
      device_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      expo_push_token TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, device_id)
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS notifications_order_state_dispatches (
      dispatch_key TEXT PRIMARY KEY,
      user_id UUID NOT NULL,
      order_id UUID NOT NULL,
      status TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS notifications_outbox (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      device_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      expo_push_token TEXT NOT NULL,
      payload_json JSONB NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      dispatched_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS notifications_outbox_status_available_idx
    ON notifications_outbox (status, available_at, created_at)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS catalog_menu_categories (
      location_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (location_id, category_id)
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS catalog_menu_categories_location_sort_idx
    ON catalog_menu_categories (location_id, sort_order)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS catalog_menu_items (
      location_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT,
      price_cents INTEGER NOT NULL,
      badge_codes_json JSONB NOT NULL,
      visible BOOLEAN NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (location_id, item_id),
      FOREIGN KEY (location_id, category_id) REFERENCES catalog_menu_categories (location_id, category_id) ON DELETE CASCADE
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS catalog_menu_items_location_category_sort_idx
    ON catalog_menu_items (location_id, category_id, sort_order)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS catalog_store_configs (
      location_id TEXT PRIMARY KEY,
      prep_eta_minutes INTEGER NOT NULL,
      tax_rate_basis_points INTEGER NOT NULL,
      pickup_instructions TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP TABLE IF EXISTS catalog_store_configs`.execute(db);
  await sql`DROP TABLE IF EXISTS catalog_menu_items`.execute(db);
  await sql`DROP TABLE IF EXISTS catalog_menu_categories`.execute(db);
  await sql`DROP TABLE IF EXISTS notifications_outbox`.execute(db);
  await sql`DROP TABLE IF EXISTS notifications_order_state_dispatches`.execute(db);
  await sql`DROP TABLE IF EXISTS notifications_push_tokens`.execute(db);
  await sql`DROP TABLE IF EXISTS identity_passkey_credentials`.execute(db);
  await sql`DROP TABLE IF EXISTS identity_passkey_challenges`.execute(db);
  await sql`DROP TABLE IF EXISTS identity_sessions`.execute(db);
  await sql`DROP TABLE IF EXISTS orders_payment_idempotency`.execute(db);
  await sql`DROP TABLE IF EXISTS orders_create_idempotency`.execute(db);
  await sql`DROP TABLE IF EXISTS orders`.execute(db);
  await sql`DROP TABLE IF EXISTS orders_quotes`.execute(db);
  await sql`DROP TABLE IF EXISTS loyalty_idempotency_keys`.execute(db);
  await sql`DROP TABLE IF EXISTS loyalty_ledger_entries`.execute(db);
  await sql`DROP TABLE IF EXISTS loyalty_balances`.execute(db);
  await sql`DROP TABLE IF EXISTS payments_refunds`.execute(db);
  await sql`DROP TABLE IF EXISTS payments_charges`.execute(db);
}
