import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE identity_users
    ADD COLUMN IF NOT EXISTS name TEXT
  `.execute(db);

  await sql`
    ALTER TABLE identity_users
    ADD COLUMN IF NOT EXISTS phone_number TEXT
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`
    ALTER TABLE identity_users
    DROP COLUMN IF EXISTS phone_number
  `.execute(db);

  await sql`
    ALTER TABLE identity_users
    DROP COLUMN IF EXISTS name
  `.execute(db);
}
