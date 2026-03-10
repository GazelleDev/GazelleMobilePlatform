import { createHash, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  createOrderRequestSchema,
  orderQuoteSchema,
  orderSchema,
  payOrderRequestSchema,
  quoteRequestSchema
} from "@gazelle/contracts-orders";
import { z } from "zod";

const payloadSchema = z.object({
  id: z.string().uuid().optional()
});

const orderIdParamsSchema = z.object({
  orderId: z.string().uuid()
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

const paymentsChargeRequestSchema = z.object({
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  applePayToken: z.string().min(1),
  idempotencyKey: z.string().min(1)
});

const paymentsChargeStatusSchema = z.enum(["SUCCEEDED", "DECLINED", "TIMEOUT"]);

const paymentsChargeResponseSchema = z.object({
  paymentId: z.string().uuid(),
  provider: z.literal("CLOVER"),
  orderId: z.string().uuid(),
  status: paymentsChargeStatusSchema,
  approved: z.boolean(),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  occurredAt: z.string().datetime(),
  declineCode: z.string().optional(),
  message: z.string().optional()
});

const paymentsRefundRequestSchema = z.object({
  orderId: z.string().uuid(),
  paymentId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  reason: z.string().min(1),
  idempotencyKey: z.string().min(1)
});

const paymentsRefundResponseSchema = z.object({
  refundId: z.string().uuid(),
  provider: z.literal("CLOVER"),
  orderId: z.string().uuid(),
  paymentId: z.string().uuid(),
  status: z.enum(["REFUNDED", "REJECTED"]),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  occurredAt: z.string().datetime(),
  message: z.string().optional()
});

const unitPriceByItemId: Record<string, number> = {
  latte: 675,
  "cold-brew": 550,
  croissant: 425,
  matcha: 725
};

const fallbackUnitPriceCents = 500;
const taxRateBasisPoints = 600;

type OrderQuote = z.output<typeof orderQuoteSchema>;
type Order = z.output<typeof orderSchema>;

const quotesById = new Map<string, OrderQuote>();
const ordersById = new Map<string, Order>();
const createOrderIdempotencyMap = new Map<string, string>();
const paymentIdempotencyMap = new Map<string, Order>();
const paymentIdByOrderId = new Map<string, string>();

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

function parseJsonSafely(rawBody: string): unknown {
  if (!rawBody) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

function buildQuoteHash(input: {
  locationId: string;
  items: Array<{ itemId: string; quantity: number; unitPriceCents: number }>;
  pointsToRedeem: number;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}) {
  const sortedItems = [...input.items].sort((left, right) => left.itemId.localeCompare(right.itemId));
  const hashPayload = JSON.stringify({
    locationId: input.locationId,
    pointsToRedeem: input.pointsToRedeem,
    subtotalCents: input.subtotalCents,
    discountCents: input.discountCents,
    taxCents: input.taxCents,
    totalCents: input.totalCents,
    items: sortedItems
  });

  return createHash("sha256").update(hashPayload).digest("hex");
}

function getItemUnitPriceCents(itemId: string) {
  return unitPriceByItemId[itemId] ?? fallbackUnitPriceCents;
}

function createQuote(input: z.output<typeof quoteRequestSchema>): OrderQuote {
  const quotedItems = input.items.map((item) => ({
    itemId: item.itemId,
    quantity: item.quantity,
    unitPriceCents: getItemUnitPriceCents(item.itemId)
  }));
  const subtotalCents = quotedItems.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  const appliedPoints = Math.min(input.pointsToRedeem, subtotalCents);
  const taxBaseCents = subtotalCents - appliedPoints;
  const taxCents = Math.round((taxBaseCents * taxRateBasisPoints) / 10_000);
  const totalCents = taxBaseCents + taxCents;

  return orderQuoteSchema.parse({
    quoteId: randomUUID(),
    locationId: input.locationId,
    items: quotedItems,
    subtotal: { currency: "USD", amountCents: subtotalCents },
    discount: { currency: "USD", amountCents: appliedPoints },
    tax: { currency: "USD", amountCents: taxCents },
    total: { currency: "USD", amountCents: totalCents },
    pointsToRedeem: appliedPoints,
    quoteHash: buildQuoteHash({
      locationId: input.locationId,
      items: quotedItems,
      pointsToRedeem: appliedPoints,
      subtotalCents,
      discountCents: appliedPoints,
      taxCents,
      totalCents
    })
  });
}

function buildPickupCode(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 6).toUpperCase();
}

function appendOrderStatus(order: Order, status: z.output<typeof orderSchema>["status"], note?: string): Order {
  return orderSchema.parse({
    ...order,
    status,
    timeline: [
      ...order.timeline,
      {
        status,
        occurredAt: new Date().toISOString(),
        ...(note ? { note } : {})
      }
    ]
  });
}

function createOrderFromQuote(quote: OrderQuote): Order {
  const orderId = randomUUID();

  return orderSchema.parse({
    id: orderId,
    locationId: quote.locationId,
    status: "PENDING_PAYMENT",
    items: quote.items,
    total: quote.total,
    pickupCode: buildPickupCode(orderId),
    timeline: [
      {
        status: "PENDING_PAYMENT",
        occurredAt: new Date().toISOString(),
        note: "Order created from quote"
      }
    ]
  });
}

function getOrderList() {
  return z
    .array(orderSchema)
    .parse(
      [...ordersById.values()].sort((left, right) => {
        const leftCreatedAt = Date.parse(left.timeline[0]?.occurredAt ?? "1970-01-01T00:00:00.000Z");
        const rightCreatedAt = Date.parse(right.timeline[0]?.occurredAt ?? "1970-01-01T00:00:00.000Z");
        return rightCreatedAt - leftCreatedAt;
      })
    );
}

export async function registerRoutes(app: FastifyInstance) {
  const paymentsBaseUrl = process.env.PAYMENTS_SERVICE_BASE_URL ?? "http://127.0.0.1:3003";

  app.get("/health", async () => ({ status: "ok", service: "orders" }));
  app.get("/ready", async () => ({ status: "ready", service: "orders" }));

  app.post("/v1/orders/quote", async (request) => {
    const input = quoteRequestSchema.parse(request.body);
    const quote = createQuote(input);

    quotesById.set(quote.quoteId, quote);
    return quote;
  });

  app.post("/v1/orders", async (request, reply) => {
    const input = createOrderRequestSchema.parse(request.body);
    const quote = quotesById.get(input.quoteId);

    if (!quote) {
      return sendError(reply, {
        statusCode: 404,
        code: "QUOTE_NOT_FOUND",
        message: "Quote not found",
        requestId: request.id,
        details: { quoteId: input.quoteId }
      });
    }

    if (quote.quoteHash !== input.quoteHash) {
      return sendError(reply, {
        statusCode: 409,
        code: "QUOTE_HASH_MISMATCH",
        message: "Quote hash does not match current quote",
        requestId: request.id,
        details: { quoteId: input.quoteId }
      });
    }

    const createOrderKey = `${input.quoteId}:${input.quoteHash}`;
    const existingOrderId = createOrderIdempotencyMap.get(createOrderKey);

    if (existingOrderId) {
      const existingOrder = ordersById.get(existingOrderId);
      if (existingOrder) {
        return existingOrder;
      }
    }

    const order = createOrderFromQuote(quote);
    ordersById.set(order.id, order);
    createOrderIdempotencyMap.set(createOrderKey, order.id);

    return order;
  });

  app.post("/v1/orders/:orderId/pay", async (request, reply) => {
    const { orderId } = orderIdParamsSchema.parse(request.params);
    const input = payOrderRequestSchema.parse(request.body);
    const existingOrder = ordersById.get(orderId);

    if (!existingOrder) {
      return sendError(reply, {
        statusCode: 404,
        code: "ORDER_NOT_FOUND",
        message: "Order not found",
        requestId: request.id,
        details: { orderId }
      });
    }

    if (existingOrder.status === "CANCELED") {
      return sendError(reply, {
        statusCode: 409,
        code: "ORDER_NOT_PAYABLE",
        message: "Canceled orders cannot be paid",
        requestId: request.id,
        details: { orderId, status: existingOrder.status }
      });
    }

    const idempotencyKey = `${orderId}:${input.idempotencyKey}`;
    const existingPaymentResult = paymentIdempotencyMap.get(idempotencyKey);

    if (existingPaymentResult) {
      return existingPaymentResult;
    }

    if (existingOrder.status !== "PENDING_PAYMENT") {
      return existingOrder;
    }

    const chargeRequestPayload = paymentsChargeRequestSchema.parse({
      orderId,
      amountCents: existingOrder.total.amountCents,
      currency: existingOrder.total.currency,
      applePayToken: input.applePayToken,
      idempotencyKey: input.idempotencyKey
    });

    let chargeResponse: Response;
    try {
      chargeResponse = await fetch(`${paymentsBaseUrl}/v1/payments/charges`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": request.id
        },
        body: JSON.stringify(chargeRequestPayload)
      });
    } catch {
      return sendError(reply, {
        statusCode: 502,
        code: "PAYMENTS_UNAVAILABLE",
        message: "Payments service is unavailable",
        requestId: request.id
      });
    }

    const parsedChargeBody = parseJsonSafely(await chargeResponse.text());

    if (!chargeResponse.ok) {
      return sendError(reply, {
        statusCode: 502,
        code: "PAYMENTS_ERROR",
        message: `Payments charge request failed with status ${chargeResponse.status}`,
        requestId: request.id,
        details: { upstreamBody: parsedChargeBody }
      });
    }

    const parsedCharge = paymentsChargeResponseSchema.safeParse(parsedChargeBody);
    if (!parsedCharge.success) {
      return sendError(reply, {
        statusCode: 502,
        code: "PAYMENTS_INVALID_RESPONSE",
        message: "Payments service returned an invalid charge response",
        requestId: request.id,
        details: parsedCharge.error.flatten()
      });
    }

    if (parsedCharge.data.status === "DECLINED") {
      return sendError(reply, {
        statusCode: 402,
        code: "PAYMENT_DECLINED",
        message: parsedCharge.data.message ?? "Payment was declined",
        requestId: request.id,
        details: {
          paymentId: parsedCharge.data.paymentId,
          provider: parsedCharge.data.provider,
          declineCode: parsedCharge.data.declineCode
        }
      });
    }

    if (parsedCharge.data.status === "TIMEOUT") {
      return sendError(reply, {
        statusCode: 504,
        code: "PAYMENT_TIMEOUT",
        message: parsedCharge.data.message ?? "Payment timed out",
        requestId: request.id,
        details: {
          paymentId: parsedCharge.data.paymentId,
          provider: parsedCharge.data.provider
        }
      });
    }

    const paidOrder = appendOrderStatus(existingOrder, "PAID", "Clover payment accepted");
    ordersById.set(orderId, paidOrder);
    paymentIdByOrderId.set(orderId, parsedCharge.data.paymentId);
    paymentIdempotencyMap.set(idempotencyKey, paidOrder);

    return paidOrder;
  });

  app.get("/v1/orders", async () => getOrderList());

  app.get("/v1/orders/:orderId", async (request, reply) => {
    const { orderId } = orderIdParamsSchema.parse(request.params);
    const order = ordersById.get(orderId);

    if (!order) {
      return sendError(reply, {
        statusCode: 404,
        code: "ORDER_NOT_FOUND",
        message: "Order not found",
        requestId: request.id,
        details: { orderId }
      });
    }

    return orderSchema.parse(order);
  });

  app.post("/v1/orders/:orderId/cancel", async (request, reply) => {
    const { orderId } = orderIdParamsSchema.parse(request.params);
    const input = cancelOrderRequestSchema.parse(request.body);
    const existingOrder = ordersById.get(orderId);

    if (!existingOrder) {
      return sendError(reply, {
        statusCode: 404,
        code: "ORDER_NOT_FOUND",
        message: "Order not found",
        requestId: request.id,
        details: { orderId }
      });
    }

    if (existingOrder.status === "COMPLETED") {
      return sendError(reply, {
        statusCode: 409,
        code: "ORDER_NOT_CANCELABLE",
        message: "Completed orders cannot be canceled",
        requestId: request.id,
        details: { orderId, status: existingOrder.status }
      });
    }

    if (existingOrder.status === "CANCELED") {
      return existingOrder;
    }

    let refundNote = "";
    if (existingOrder.status === "PAID") {
      const paymentId = paymentIdByOrderId.get(orderId);
      if (!paymentId) {
        return sendError(reply, {
          statusCode: 409,
          code: "REFUND_REFERENCE_MISSING",
          message: "Unable to locate payment reference for refund",
          requestId: request.id,
          details: { orderId }
        });
      }

      const refundPayload = paymentsRefundRequestSchema.parse({
        orderId,
        paymentId,
        amountCents: existingOrder.total.amountCents,
        currency: existingOrder.total.currency,
        reason: input.reason,
        idempotencyKey: `cancel:${orderId}`
      });

      let refundResponse: Response;
      try {
        refundResponse = await fetch(`${paymentsBaseUrl}/v1/payments/refunds`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-request-id": request.id
          },
          body: JSON.stringify(refundPayload)
        });
      } catch {
        return sendError(reply, {
          statusCode: 502,
          code: "PAYMENTS_UNAVAILABLE",
          message: "Payments service is unavailable",
          requestId: request.id
        });
      }

      const parsedRefundBody = parseJsonSafely(await refundResponse.text());
      if (!refundResponse.ok) {
        return sendError(reply, {
          statusCode: 502,
          code: "REFUND_REQUEST_FAILED",
          message: `Payments refund request failed with status ${refundResponse.status}`,
          requestId: request.id,
          details: { upstreamBody: parsedRefundBody }
        });
      }

      const parsedRefund = paymentsRefundResponseSchema.safeParse(parsedRefundBody);
      if (!parsedRefund.success) {
        return sendError(reply, {
          statusCode: 502,
          code: "PAYMENTS_INVALID_RESPONSE",
          message: "Payments service returned an invalid refund response",
          requestId: request.id,
          details: parsedRefund.error.flatten()
        });
      }

      if (parsedRefund.data.status === "REJECTED") {
        return sendError(reply, {
          statusCode: 409,
          code: "REFUND_REJECTED",
          message: parsedRefund.data.message ?? "Clover rejected the refund",
          requestId: request.id,
          details: {
            paymentId: parsedRefund.data.paymentId,
            refundId: parsedRefund.data.refundId,
            provider: parsedRefund.data.provider
          }
        });
      }

      refundNote = ` Refund submitted: ${parsedRefund.data.refundId}.`;
    }

    const canceledOrder = appendOrderStatus(
      existingOrder,
      "CANCELED",
      `Canceled by customer: ${input.reason}.${refundNote}`
    );
    ordersById.set(orderId, canceledOrder);

    return canceledOrder;
  });

  app.post("/v1/orders/internal/ping", async (request) => {
    const parsed = payloadSchema.parse(request.body ?? {});

    return {
      service: "orders",
      accepted: true,
      payload: parsed
    };
  });
}
