import { randomUUID } from "node:crypto";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { up } from "../src/migrations/0046_reporting_locations_and_indexes.js";

const databaseUrl = process.env.PERSISTENCE_TEST_DATABASE_URL;
const describeWithPostgres = databaseUrl ? describe : describe.skip;

describeWithPostgres("reporting location timezone migration (PostgreSQL)", () => {
  const schema = `test_reporting_timezone_${randomUUID().replaceAll("-", "")}`;
  const adminPool = new Pool({ connectionString: databaseUrl });
  const migrationPool = new Pool({ connectionString: databaseUrl, options: `-c search_path=${schema},public` });
  const db = new Kysely<Record<string, never>>({ dialect: new PostgresDialect({ pool: migrationPool }) });

  beforeAll(async () => {
    await adminPool.query(`CREATE SCHEMA ${schema}`);
    await migrationPool.query(`
      CREATE TABLE catalog_client_locations (
        location_id TEXT PRIMARY KEY
      );
      INSERT INTO catalog_client_locations (location_id) VALUES ('existing-location');
      CREATE TABLE payments_charges (
        occurred_at TIMESTAMPTZ NOT NULL,
        order_id TEXT NOT NULL,
        status TEXT NOT NULL,
        approved BOOLEAN NOT NULL
      );
      CREATE TABLE payments_refunds (
        occurred_at TIMESTAMPTZ NOT NULL,
        order_id TEXT NOT NULL,
        status TEXT NOT NULL
      );
      CREATE TABLE orders (
        order_json JSONB NOT NULL
      );
    `);
  });

  afterAll(async () => {
    await db.destroy();
    await adminPool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await adminPool.end();
  });

  it("backfills existing locations and defaults newly inserted locations to the safe deployment timezone", async () => {
    await up(db);

    const existing = await migrationPool.query<{ timezone: string }>(
      `SELECT timezone FROM catalog_client_locations WHERE location_id = 'existing-location'`
    );
    expect(existing.rows).toEqual([{ timezone: "America/Detroit" }]);

    await migrationPool.query(`INSERT INTO catalog_client_locations (location_id) VALUES ('new-location')`);
    const added = await migrationPool.query<{ timezone: string }>(
      `SELECT timezone FROM catalog_client_locations WHERE location_id = 'new-location'`
    );
    expect(added.rows).toEqual([{ timezone: "America/Detroit" }]);
  });
});
