import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createCatalogRepository } from "./repository.js";

const payloadSchema = z.object({
  id: z.string().uuid().optional()
});

export async function registerRoutes(app: FastifyInstance) {
  const repository = await createCatalogRepository(app.log);

  app.addHook("onClose", async () => {
    await repository.close();
  });

  app.get("/health", async () => ({ status: "ok", service: "catalog" }));
  app.get("/ready", async () => ({ status: "ready", service: "catalog", persistence: repository.backend }));

  app.get("/v1/menu", async () => repository.getMenu());

  app.get("/v1/store/config", async () => repository.getStoreConfig());

  app.post("/v1/catalog/internal/ping", async (request) => {
    const parsed = payloadSchema.parse(request.body ?? {});

    return {
      service: "catalog",
      accepted: true,
      payload: parsed
    };
  });
}
