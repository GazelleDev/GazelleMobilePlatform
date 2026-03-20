import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS identity_users (
      user_id UUID PRIMARY KEY,
      apple_sub TEXT UNIQUE,
      email TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS identity_users_apple_sub_idx
    ON identity_users (apple_sub)
    WHERE apple_sub IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS identity_users_email_unique_idx
    ON identity_users (email)
    WHERE email IS NOT NULL
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP TABLE IF EXISTS identity_users`.execute(db);
}
