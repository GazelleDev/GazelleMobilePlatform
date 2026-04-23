import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`DROP TABLE IF EXISTS identity_magic_links`.execute(db);
  await sql`DROP TABLE IF EXISTS operator_magic_links`.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS identity_magic_links (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      user_id UUID,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS identity_magic_links_email_idx
    ON identity_magic_links (email, created_at DESC)
  `.execute(db);

  await sql`
    CREATE TABLE IF NOT EXISTS operator_magic_links (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      operator_user_id UUID,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS operator_magic_links_email_idx
    ON operator_magic_links (email, created_at DESC)
  `.execute(db);
}
