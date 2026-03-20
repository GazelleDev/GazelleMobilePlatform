import { createPostgresDb, getDatabaseUrl } from "./index.js";
import { runMigrations } from "./migrate.js";

async function main(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    console.error("[persistence] DATABASE_URL is required to run migrations");
    process.exit(1);
  }

  const db = createPostgresDb(databaseUrl);

  try {
    await runMigrations(db);
    console.info("[persistence] migrations finished successfully");
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error("[persistence] migrations failed", error);
  process.exit(1);
});
