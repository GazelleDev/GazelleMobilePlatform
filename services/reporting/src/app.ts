import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { buildFastifyLoggerOptions, initializeSentry, registerSentryErrorHook } from "@lattelink/observability";
import { registerRoutes } from "./routes.js";

export async function buildApp() {
  const app = Fastify({ logger: buildFastifyLoggerOptions("reporting"), genReqId: (request) => (request.headers["x-request-id"] as string | undefined) ?? randomUUID() });
  initializeSentry({ service: "reporting" });
  registerSentryErrorHook(app, "reporting");
  await registerRoutes(app);
  return app;
}
