import { buildMenuSyncConfig, createMenuSyncRuntime, startMenuSyncWorker } from "./worker.js";

let workerHandle: { stop: () => void } | undefined;
let idleHandle: ReturnType<typeof setInterval> | undefined;

function shutdown(signal: NodeJS.Signals) {
  console.info(`[menu-sync] received ${signal}; stopping worker loop`);
  workerHandle?.stop();
  if (idleHandle) {
    clearInterval(idleHandle);
    idleHandle = undefined;
  }
}

try {
  const config = buildMenuSyncConfig();
  if (!config.enabled) {
    console.info("[menu-sync] disabled: WEBAPP_MENU_SOURCE_URL is not configured");
    idleHandle = setInterval(() => undefined, 24 * 60 * 60 * 1000);
  } else {
    const runtime = createMenuSyncRuntime(config);
    workerHandle = startMenuSyncWorker(config, runtime);
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
} catch (error) {
  console.error("[menu-sync] fatal", error);
  process.exit(1);
}
