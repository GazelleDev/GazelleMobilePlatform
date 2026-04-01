import type { Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

export async function up(_db: MigrationDb): Promise<void> {
  void _db;
  // `image_url` shipped with the original catalog table introduction.
  // This migration slot is kept to preserve the documented numbered history.
}

export async function down(_db: MigrationDb): Promise<void> {
  void _db;
  // No-op for the same reason as `up`.
}
