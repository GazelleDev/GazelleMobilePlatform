import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS internal_admin_users (
      internal_admin_user_id UUID PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS internal_admin_users_email_unique_idx
    ON internal_admin_users (email)
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS internal_admin_users_role_idx
    ON internal_admin_users (role, active)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS internal_admin_sessions (
      access_token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL UNIQUE,
      internal_admin_user_id UUID NOT NULL,
      access_expires_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      auth_method TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS internal_admin_sessions_user_id_idx
    ON internal_admin_sessions (internal_admin_user_id, created_at DESC)
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP TABLE IF EXISTS internal_admin_sessions`.execute(db);
  await sql`DROP TABLE IF EXISTS internal_admin_users`.execute(db);
}
