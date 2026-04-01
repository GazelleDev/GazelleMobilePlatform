import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE identity_sessions
    ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE identity_sessions
    DROP COLUMN IF EXISTS access_expires_at
  `.execute(db);
}
