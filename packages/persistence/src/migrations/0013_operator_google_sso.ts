import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE operator_users
    ADD COLUMN IF NOT EXISTS google_sub TEXT
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS operator_users_google_sub_unique_idx
    ON operator_users (google_sub)
    WHERE google_sub IS NOT NULL
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`DROP INDEX IF EXISTS operator_users_google_sub_unique_idx`.execute(db);
  await sql`ALTER TABLE operator_users DROP COLUMN IF EXISTS google_sub`.execute(db);
}
