import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  createOrderRequestSchema,
  ordersPaymentReconciliationSchema,
  orderSchema,
  payOrderRequestSchema,
  quoteRequestSchema
} from "@gazelle/contracts-orders";
import { z } from "zod";
import { resolveConfiguredOrderFulfillment } from "./fulfillment.js";
import { createOrdersRepository } from "./repository.js";
import {
  advanceOrderStatus,
  cancelOrder,
  createOrder,
  createQuote,
  getOrderForRead,
  listOrdersForRead,
  processPayment,
  reconcilePaymentWebhook,
  type CancelOrderSource,
  type OrderServiceDeps,
  type RequestUserContext,
  type ServiceError
} from "./service.js";

const payloadSchema = z.object({
  id: z.string().uuid().optional()
});

const orderIdParamsSchema = z.object({
  orderId: z.string().uuid()
});

const orderStatusUpdateRequestSchema = z.object({
  status: z.enum(["IN_PREP", "READY", "COMPLETED"]),
  note: z.string().min(1).optional()
});

const cancelOrderRequestSchema = z.object({
  reason: z.string().min(1)
});

const serviceErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.record(z.unknown()).optional()
});

const userHeadersSchema = z.object({
  "x-user-id": z.string().uuid().optional()
});

const internalHeadersSchema = z.object({
  "x-internal-token": z.string().optional()
});

const gatewayHeadersSchema = z.object({
  "x-gateway-token": z.string().optional()
});

const cancelSourceHeadersSchema = z.object({
  "x-order-cancel-source": z.enum(["customer", "staff"]).optional()
});

const defaultRateLimitWindowMs = 60_000;
const defaultOrdersWriteRateLimitMax = 120;
const defaultOrdersInternalReconcileRateLimitMax = 180;

function trimToUndefined(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

function toPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function sendError(
  reply: FastifyReply,
  input: {
    statusCode: number;
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, unknown>;
  }
) {
  return reply.status(input.statusCode).send(
    serviceErrorSchema.parse({
      code: input.code,
      message: input.message,
      requestId: input.requestId,
      details: input.details
    })
  );
}

function sendServiceError(reply: FastifyReply, request: FastifyRequest, error: ServiceError) {
  if (error.code === "INVALID_USER_CONTEXT") {
    request.log.warn(
      {
        requestId: request.id,
        details: error.details
      },
      "invalid x-user-id header"
    );
  }

  return sendError(reply, {
    ...error,
    requestId: request.id
  });
}

function parseRequestUserContext(request: FastifyRequest): RequestUserContext {
  const parsedHeaders = userHeadersSchema.safeParse(request.headers);
  if (!parsedHeaders.success) {
    return {
      error: {
        statusCode: 400,
        code: "INVALID_USER_CONTEXT",
        message: "x-user-id header must be a UUID when provided",
        details: parsedHeaders.error.flatten()
      }
    };
  }

  return {
    userId: parsedHeaders.data["x-user-id"]
  };
}

function authorizeInternalRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  internalToken: string | undefined
) {
  if (!internalToken) {
    return true;
  }

  const parsedHeaders = internalHeadersSchema.safeParse(request.headers);
  const providedToken = parsedHeaders.success ? parsedHeaders.data["x-internal-token"] : undefined;
  if (providedToken === internalToken) {
    return true;
  }

  sendError(reply, {
    statusCode: 401,
    code: "UNAUTHORIZED_INTERNAL_REQUEST",
    message: "Internal reconciliation token is invalid",
    requestId: request.id
  });
  return false;
}

function authorizeGatewayRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  gatewayToken: string | undefined
) {
  if (!gatewayToken) {
    return true;
  }

  const parsedHeaders = gatewayHeadersSchema.safeParse(request.headers);
  const providedToken = parsedHeaders.success ? parsedHeaders.data["x-gateway-token"] : undefined;
  if (providedToken === gatewayToken) {
    return true;
  }

  sendError(reply, {
    statusCode: 401,
    code: "UNAUTHORIZED_GATEWAY_REQUEST",
    message: "Gateway token is invalid",
    requestId: request.id
  });
  return false;
}

export async function registerRoutes(app: FastifyInstance) {
  const paymentsBaseUrl = process.env.PAYMENTS_SERVICE_BASE_URL ?? "http://127.0.0.1:3003";
  const loyaltyBaseUrl = process.env.LOYALTY_SERVICE_BASE_URL ?? "http://127.0.0.1:3004";
  const notificationsBaseUrl = process.env.NOTIFICATIONS_SERVICE_BASE_URL ?? "http://127.0.0.1:3005";
  const internalApiToken = trimToUndefined(process.env.ORDERS_INTERNAL_API_TOKEN);
  const ordersRateLimitWindowMs = toPositiveInteger(process.env.ORDERS_RATE_LIMIT_WINDOW_MS, defaultRateLimitWindowMs);
  const ordersWriteRateLimit = {
    max: toPositiveInteger(process.env.ORDERS_RATE_LIMIT_WRITE_MAX, defaultOrdersWriteRateLimitMax),
    timeWindow: ordersRateLimitWindowMs
  };
  const ordersInternalReconcileRateLimit = {
    max: toPositiveInteger(
      process.env.ORDERS_RATE_LIMIT_INTERNAL_RECONCILE_MAX,
      defaultOrdersInternalReconcileRateLimitMax
    ),
    timeWindow: ordersRateLimitWindowMs
  };
  const gatewayApiToken = trimToUndefined(process.env.GATEWAY_INTERNAL_API_TOKEN);
  const fulfillmentConfig = resolveConfiguredOrderFulfillment();
  const repository = await createOrdersRepository(app.log);
  const sharedDeps = {
    repository,
    paymentsBaseUrl,
    loyaltyBaseUrl,
    notificationsBaseUrl,
    fulfillmentConfig
  };

  const getServiceDeps = (request: FastifyRequest): OrderServiceDeps => ({
    ...sharedDeps,
    logger: request.log
  });

  app.addHook("onClose", async () => {
    await repository.close();
  });

  app.get("/health", async () => ({ status: "ok", service: "orders" }));
  app.get("/ready", async () => ({ status: "ready", service: "orders", persistence: repository.backend }));

  app.post(
    "/v1/orders/internal/payments/reconcile",
    {
      preHandler: app.rateLimit(ordersInternalReconcileRateLimit)
    },
    async (request, reply) => {
      if (!authorizeInternalRequest(request, reply, internalApiToken)) {
        return;
      }

      const input = ordersPaymentReconciliationSchema.parse(request.body);
      const result = await reconcilePaymentWebhook({
        input,
        requestId: request.id,
        deps: getServiceDeps(request)
      });

      if ("error" in result) {
        return sendServiceError(reply, request, result.error);
      }

      return result.result;
    }
  );

  app.post(
    "/v1/orders/quote",
    {
      preHandler: app.rateLimit(ordersWriteRateLimit)
    },
    async (request, reply) => {
      if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
        return;
      }

      const input = quoteRequestSchema.parse(request.body);
      const result = await createQuote({
        input,
        deps: getServiceDeps(request)
      });

      if ("error" in result) {
        return sendServiceError(reply, request, result.error);
      }

      await repository.saveQuote(result.quote);
      return result.quote;
    }
  );

  app.post(
    "/v1/orders",
    {
      preHandler: app.rateLimit(ordersWriteRateLimit)
    },
    async (request, reply) => {
      if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
        return;
      }

      const input = createOrderRequestSchema.parse(request.body);
      const requestUserContext = parseRequestUserContext(request);
      const result = await createOrder({
        input,
        requestId: request.id,
        requestUserContext,
        deps: getServiceDeps(request)
      });

      if ("error" in result) {
        return sendServiceError(reply, request, result.error);
      }

      return result.order;
    }
  );

  app.post(
    "/v1/orders/:orderId/pay",
    {
      preHandler: app.rateLimit(ordersWriteRateLimit)
    },
    async (request, reply) => {
      if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
        return;
      }

      const { orderId } = orderIdParamsSchema.parse(request.params);
      const input = payOrderRequestSchema.parse(request.body);
      const requestUserContext = parseRequestUserContext(request);
      const result = await processPayment({
        orderId,
        input,
        requestId: request.id,
        requestUserContext,
        deps: getServiceDeps(request)
      });

      if ("error" in result) {
        return sendServiceError(reply, request, result.error);
      }

      return result.order;
    }
  );

  app.get("/v1/orders", async (request, reply) => {
    if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
      return;
    }

    const requestUserContext = parseRequestUserContext(request);
    if (requestUserContext.error) {
      return sendServiceError(reply, request, requestUserContext.error);
    }

    const result = await listOrdersForRead({
      requestId: request.id,
      requestUserId: requestUserContext.userId,
      deps: getServiceDeps(request)
    });

    return z.array(orderSchema).parse(result.orders);
  });

  app.get("/v1/orders/:orderId", async (request, reply) => {
    if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
      return;
    }

    const { orderId } = orderIdParamsSchema.parse(request.params);
    const result = await getOrderForRead({
      orderId,
      requestId: request.id,
      deps: getServiceDeps(request)
    });

    if ("error" in result) {
      return sendServiceError(reply, request, result.error);
    }

    return orderSchema.parse(result.order);
  });

  app.post(
    "/v1/orders/:orderId/cancel",
    {
      preHandler: app.rateLimit(ordersWriteRateLimit)
    },
    async (request, reply) => {
      if (!authorizeGatewayRequest(request, reply, gatewayApiToken)) {
        return;
      }

      const { orderId } = orderIdParamsSchema.parse(request.params);
      const input = cancelOrderRequestSchema.parse(request.body);
      const parsedCancelHeaders = cancelSourceHeadersSchema.safeParse(request.headers);
      const cancelSource: CancelOrderSource = parsedCancelHeaders.success
        ? (parsedCancelHeaders.data["x-order-cancel-source"] ?? "customer")
        : "customer";
      const requestUserContext = parseRequestUserContext(request);
      const result = await cancelOrder({
        orderId,
        input,
        cancelSource,
        requestId: request.id,
        requestUserContext,
        deps: getServiceDeps(request)
      });

      if ("error" in result) {
        return sendServiceError(reply, request, result.error);
      }

      return result.order;
    }
  );

  app.post(
    "/v1/orders/:orderId/status",
    {
      preHandler: app.rateLimit(ordersWriteRateLimit)
    },
    async (request, reply) => {
      if (!authorizeInternalRequest(request, reply, internalApiToken)) {
        return;
      }

      const { orderId } = orderIdParamsSchema.parse(request.params);
      const input = orderStatusUpdateRequestSchema.parse(request.body);
      const result = await advanceOrderStatus({
        orderId,
        input,
        requestId: request.id,
        deps: getServiceDeps(request)
      });

      if ("error" in result) {
        return sendServiceError(reply, request, result.error);
      }

      return result.order;
    }
  );

  app.post("/v1/orders/internal/ping", async (request) => {
    const parsed = payloadSchema.parse(request.body ?? {});

    return {
      service: "orders",
      accepted: true,
      payload: parsed
    };
  });
}
