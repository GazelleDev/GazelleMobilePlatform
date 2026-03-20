import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  adminMenuItemUpdateSchema,
  adminStoreConfigUpdateSchema
} from "@gazelle/contracts-catalog";
import { z } from "zod";
import { createCatalogRepository } from "./repository.js";

const payloadSchema = z.object({
  id: z.string().uuid().optional()
});

const menuItemParamsSchema = z.object({
  itemId: z.string().min(1)
});

const serviceErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.record(z.unknown()).optional()
});

const gatewayHeadersSchema = z.object({
  "x-gateway-token": z.string().optional()
});

function trimToUndefined(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

function authorizeGatewayRequest(request: FastifyRequest, reply: FastifyReply, gatewayToken: string | undefined) {
  if (!gatewayToken) {
    return true;
  }

  const parsedHeaders = gatewayHeadersSchema.safeParse(request.headers);
  const providedToken = parsedHeaders.success ? parsedHeaders.data["x-gateway-token"] : undefined;
  if (providedToken === gatewayToken) {
    return true;
  }

  reply.status(401).send(
    serviceErrorSchema.parse({
      code: "UNAUTHORIZED_GATEWAY_REQUEST",
      message: "Gateway token is invalid",
      requestId: request.id
    })
  );
  return false;
}

export async function registerRoutes(app: FastifyInstance) {
  const repository = await createCatalogRepository(app.log);
  const gatewayApiToken = trimToUndefined(process.env.GATEWAY_INTERNAL_API_TOKEN);

  app.addHook("onClose", async () => {
    await repository.close();
  });

  app.get("/health", async () => ({ status: "ok", service: "catalog" }));
  app.get("/ready", async () => ({ status: "ready", service: "catalog", persistence: repository.backend }));

  app.get("/v1/app-config", async () => repository.getAppConfig());
  app.get("/v1/menu", async () => repository.getMenu());

  app.get("/v1/store/config", async () => repository.getStoreConfig());

  app.get("/v1/catalog/admin/menu", async (request, reply) => {
    if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
      return;
    }

    return repository.getAdminMenu();
  });

  app.put("/v1/catalog/admin/menu/:itemId", async (request, reply) => {
    if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
      return;
    }

    const { itemId } = menuItemParamsSchema.parse(request.params);
    const input = adminMenuItemUpdateSchema.parse(request.body);
    const updatedItem = await repository.updateAdminMenuItem({
      itemId,
      ...input
    });

    if (!updatedItem) {
      return reply.status(404).send(
        serviceErrorSchema.parse({
          code: "MENU_ITEM_NOT_FOUND",
          message: "Menu item not found",
          requestId: request.id,
          details: { itemId }
        })
      );
    }

    return updatedItem;
  });

  app.get("/v1/catalog/admin/store/config", async (request, reply) => {
    if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
      return;
    }

    return repository.getAdminStoreConfig();
  });

  app.put("/v1/catalog/admin/store/config", async (request, reply) => {
    if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
      return;
    }

    const input = adminStoreConfigUpdateSchema.parse(request.body);
    return repository.updateAdminStoreConfig(input);
  });

  app.post("/v1/catalog/internal/ping", async (request) => {
    const parsed = payloadSchema.parse(request.body ?? {});

    return {
      service: "catalog",
      accepted: true,
      payload: parsed
    };
  });
}
