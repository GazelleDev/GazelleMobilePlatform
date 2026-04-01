import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const app = await buildApp();

await app.listen({ port, host });
app.log.info({ service: "notifications", port }, "notifications listening");

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutdown signal received, closing server')
  await app.close()
  process.exit(0)
}

process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)) })
process.on('SIGINT', () => { shutdown('SIGINT').catch(() => process.exit(1)) })
