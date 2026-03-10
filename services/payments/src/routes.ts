import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const payloadSchema = z.object({
  id: z.string().uuid().optional()
});

const chargeRequestSchema = z.object({
  orderId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  applePayToken: z.string().min(1),
  idempotencyKey: z.string().min(1)
});

const chargeStatusSchema = z.enum(["SUCCEEDED", "DECLINED", "TIMEOUT"]);

const chargeResponseSchema = z.object({
  paymentId: z.string().uuid(),
  provider: z.literal("CLOVER"),
  orderId: z.string().uuid(),
  status: chargeStatusSchema,
  approved: z.boolean(),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  occurredAt: z.string().datetime(),
  declineCode: z.string().optional(),
  message: z.string().optional()
});

const refundRequestSchema = z.object({
  orderId: z.string().uuid(),
  paymentId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  reason: z.string().min(1),
  idempotencyKey: z.string().min(1)
});

const refundStatusSchema = z.enum(["REFUNDED", "REJECTED"]);

const refundResponseSchema = z.object({
  refundId: z.string().uuid(),
  provider: z.literal("CLOVER"),
  orderId: z.string().uuid(),
  paymentId: z.string().uuid(),
  status: refundStatusSchema,
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  occurredAt: z.string().datetime(),
  message: z.string().optional()
});

const serviceErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  details: z.record(z.unknown()).optional()
});

type ChargeResponse = z.output<typeof chargeResponseSchema>;
type RefundResponse = z.output<typeof refundResponseSchema>;

const chargeResultsByIdempotency = new Map<string, ChargeResponse>();
const chargeResultByOrderId = new Map<string, ChargeResponse>();
const refundResultsByIdempotency = new Map<string, RefundResponse>();

function createChargeResponse(input: z.output<typeof chargeRequestSchema>): ChargeResponse {
  const token = input.applePayToken.toLowerCase();

  if (token.includes("decline")) {
    return chargeResponseSchema.parse({
      paymentId: randomUUID(),
      provider: "CLOVER",
      orderId: input.orderId,
      status: "DECLINED",
      approved: false,
      amountCents: input.amountCents,
      currency: input.currency,
      occurredAt: new Date().toISOString(),
      declineCode: "CARD_DECLINED",
      message: "Clover declined the charge"
    });
  }

  if (token.includes("timeout")) {
    return chargeResponseSchema.parse({
      paymentId: randomUUID(),
      provider: "CLOVER",
      orderId: input.orderId,
      status: "TIMEOUT",
      approved: false,
      amountCents: input.amountCents,
      currency: input.currency,
      occurredAt: new Date().toISOString(),
      message: "Clover timed out while processing charge"
    });
  }

  return chargeResponseSchema.parse({
    paymentId: randomUUID(),
    provider: "CLOVER",
    orderId: input.orderId,
    status: "SUCCEEDED",
    approved: true,
    amountCents: input.amountCents,
    currency: input.currency,
    occurredAt: new Date().toISOString(),
    message: "Clover accepted the charge"
  });
}

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok", service: "payments" }));
  app.get("/ready", async () => ({ status: "ready", service: "payments" }));

  app.post("/v1/payments/charges", async (request) => {
    const input = chargeRequestSchema.parse(request.body);
    const idempotencyKey = `${input.orderId}:${input.idempotencyKey}`;
    const existing = chargeResultsByIdempotency.get(idempotencyKey);

    if (existing) {
      return existing;
    }

    const chargeResponse = createChargeResponse(input);
    chargeResultsByIdempotency.set(idempotencyKey, chargeResponse);
    chargeResultByOrderId.set(input.orderId, chargeResponse);
    return chargeResponse;
  });

  app.post("/v1/payments/refunds", async (request, reply) => {
    const input = refundRequestSchema.parse(request.body);
    const idempotencyKey = `${input.orderId}:${input.idempotencyKey}`;
    const existingRefund = refundResultsByIdempotency.get(idempotencyKey);

    if (existingRefund) {
      return existingRefund;
    }

    const chargeResult = chargeResultByOrderId.get(input.orderId);
    if (!chargeResult || chargeResult.paymentId !== input.paymentId) {
      return reply.status(404).send(
        serviceErrorSchema.parse({
          code: "PAYMENT_NOT_FOUND",
          message: "Payment not found for refund",
          requestId: request.id,
          details: { orderId: input.orderId, paymentId: input.paymentId }
        })
      );
    }

    if (chargeResult.status !== "SUCCEEDED") {
      return reply.status(409).send(
        serviceErrorSchema.parse({
          code: "PAYMENT_NOT_REFUNDABLE",
          message: `Payment in status ${chargeResult.status} is not refundable`,
          requestId: request.id,
          details: { orderId: input.orderId, paymentId: input.paymentId, status: chargeResult.status }
        })
      );
    }

    const shouldReject = input.reason.toLowerCase().includes("reject");
    const refundResponse = refundResponseSchema.parse({
      refundId: randomUUID(),
      provider: "CLOVER",
      orderId: input.orderId,
      paymentId: input.paymentId,
      status: shouldReject ? "REJECTED" : "REFUNDED",
      amountCents: input.amountCents,
      currency: input.currency,
      occurredAt: new Date().toISOString(),
      message: shouldReject ? "Clover rejected the refund" : "Clover accepted the refund"
    });

    refundResultsByIdempotency.set(idempotencyKey, refundResponse);
    return refundResponse;
  });

  app.post("/v1/payments/internal/ping", async (request) => {
    const parsed = payloadSchema.parse(request.body ?? {});

    return {
      service: "payments",
      accepted: true,
      payload: parsed
    };
  });
}
