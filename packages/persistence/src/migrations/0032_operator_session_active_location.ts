import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE operator_sessions
    ADD COLUMN IF NOT EXISTS active_location_id TEXT
  `.execute(db);

  await sql`
    CREATE INDEX IF NOT EXISTS operator_sessions_active_location_idx
    ON operator_sessions (operator_user_id, active_location_id, created_at DESC)
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP INDEX IF EXISTS operator_sessions_active_location_idx`.execute(db);
  await sql`ALTER TABLE operator_sessions DROP COLUMN IF EXISTS active_location_id`.execute(db);
}
