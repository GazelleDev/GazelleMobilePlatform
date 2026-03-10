import { buildMenuSyncConfig, createMenuSyncRuntime, startMenuSyncWorker } from "./worker.js";

let workerHandle: { stop: () => void } | undefined;

function shutdown(signal: NodeJS.Signals) {
  console.info(`[menu-sync] received ${signal}; stopping worker loop`);
  workerHandle?.stop();
}

try {
  const config = buildMenuSyncConfig();
  const runtime = createMenuSyncRuntime(config);
  workerHandle = startMenuSyncWorker(config, runtime);

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
} catch (error) {
  console.error("[menu-sync] fatal", error);
  process.exit(1);
}
