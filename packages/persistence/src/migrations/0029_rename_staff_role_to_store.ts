import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(db: MigrationDb): Promise<void> {
  await sql`
    UPDATE operator_users
    SET role = 'store',
        updated_at = NOW()
    WHERE role = 'staff'
  `.execute(db);
}

export async function down(db: MigrationDb): Promise<void> {
  await sql`SELECT 1`.execute(db);
}
