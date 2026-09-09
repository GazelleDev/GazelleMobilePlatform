import { buildApp } from "./app.js";

const app = await buildApp();
const port = Number(process.env.PORT ?? 3006);
const host = process.env.HOST ?? "0.0.0.0";
await app.listen({ port, host });
app.log.info({ service: "reporting", port }, "reporting listening");

const close = async () => { await app.close(); process.exit(0); };
process.on("SIGTERM", () => { close().catch(() => process.exit(1)); });
process.on("SIGINT", () => { close().catch(() => process.exit(1)); });
