import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE identity_users
    ADD COLUMN IF NOT EXISTS birthday TEXT
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE identity_users
    DROP COLUMN IF EXISTS birthday
  `.execute(db);
}
