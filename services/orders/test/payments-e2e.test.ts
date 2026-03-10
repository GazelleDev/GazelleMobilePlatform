import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { orderQuoteSchema, orderSchema } from "@gazelle/contracts-orders";
import { buildApp as buildOrdersApp } from "../src/app.js";
import { buildApp as buildPaymentsApp } from "../../payments/src/app.js";

const sampleQuotePayload = {
  locationId: "flagship-01",
  items: [
    { itemId: "latte", quantity: 1 },
    { itemId: "croissant", quantity: 1 }
  ],
  pointsToRedeem: 0
};

describe.sequential("orders + payments e2e", () => {
  let ordersApp: FastifyInstance | undefined;
  let paymentsApp: FastifyInstance | undefined;
  let previousPaymentsBaseUrl: string | undefined;

  async function createOrder() {
    if (!ordersApp) {
      throw new Error("Orders app not initialized");
    }

    const quoteResponse = await ordersApp.inject({
      method: "POST",
      url: "/v1/orders/quote",
      payload: sampleQuotePayload
    });
    expect(quoteResponse.statusCode).toBe(200);
    const quote = orderQuoteSchema.parse(quoteResponse.json());

    const createResponse = await ordersApp.inject({
      method: "POST",
      url: "/v1/orders",
      payload: {
        quoteId: quote.quoteId,
        quoteHash: quote.quoteHash
      }
    });
    expect(createResponse.statusCode).toBe(200);
    return orderSchema.parse(createResponse.json());
  }

  beforeEach(async () => {
    previousPaymentsBaseUrl = process.env.PAYMENTS_SERVICE_BASE_URL;

    paymentsApp = await buildPaymentsApp();
    await paymentsApp.listen({ host: "127.0.0.1", port: 0 });
    const paymentsAddress = paymentsApp.server.address() as AddressInfo | null;
    if (!paymentsAddress || typeof paymentsAddress.port !== "number") {
      throw new Error("Failed to resolve payments test port");
    }

    process.env.PAYMENTS_SERVICE_BASE_URL = `http://127.0.0.1:${paymentsAddress.port}`;
    ordersApp = await buildOrdersApp();
  });

  afterEach(async () => {
    if (ordersApp) {
      await ordersApp.close();
      ordersApp = undefined;
    }

    if (paymentsApp) {
      await paymentsApp.close();
      paymentsApp = undefined;
    }

    if (previousPaymentsBaseUrl === undefined) {
      delete process.env.PAYMENTS_SERVICE_BASE_URL;
    } else {
      process.env.PAYMENTS_SERVICE_BASE_URL = previousPaymentsBaseUrl;
    }
  });

  it("keeps timeout retries idempotent per key and recovers with a new key", async () => {
    const order = await createOrder();

    const firstTimeout = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-timeout-token",
        idempotencyKey: "timeout-attempt-1"
      }
    });
    expect(firstTimeout.statusCode).toBe(504);
    expect(firstTimeout.json()).toMatchObject({ code: "PAYMENT_TIMEOUT" });

    const secondTimeout = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-timeout-token",
        idempotencyKey: "timeout-attempt-1"
      }
    });
    expect(secondTimeout.statusCode).toBe(504);
    expect(secondTimeout.json()).toMatchObject({ code: "PAYMENT_TIMEOUT" });
    expect(secondTimeout.json().details.paymentId).toBe(firstTimeout.json().details.paymentId);

    const recoveredPayment = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-success-token",
        idempotencyKey: "timeout-recovery-2"
      }
    });
    expect(recoveredPayment.statusCode).toBe(200);
    expect(orderSchema.parse(recoveredPayment.json()).status).toBe("PAID");
  });

  it("allows decline retry recovery with a new idempotency key", async () => {
    const order = await createOrder();

    const declinedPayment = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-decline-token",
        idempotencyKey: "decline-attempt-1"
      }
    });
    expect(declinedPayment.statusCode).toBe(402);
    expect(declinedPayment.json()).toMatchObject({ code: "PAYMENT_DECLINED" });

    const recoveredPayment = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-success-token",
        idempotencyKey: "decline-recovery-2"
      }
    });
    expect(recoveredPayment.statusCode).toBe(200);
    expect(orderSchema.parse(recoveredPayment.json()).status).toBe("PAID");
  });

  it("keeps successful payments idempotent for repeated keys", async () => {
    const order = await createOrder();

    const firstPay = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-success-token",
        idempotencyKey: "pay-success-idem"
      }
    });
    const secondPay = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-success-token",
        idempotencyKey: "pay-success-idem"
      }
    });

    expect(firstPay.statusCode).toBe(200);
    expect(secondPay.statusCode).toBe(200);

    const firstPaidOrder = orderSchema.parse(firstPay.json());
    const secondPaidOrder = orderSchema.parse(secondPay.json());
    expect(firstPaidOrder.status).toBe("PAID");
    expect(secondPaidOrder.id).toBe(firstPaidOrder.id);
    expect(secondPaidOrder.timeline).toHaveLength(firstPaidOrder.timeline.length);
    expect(firstPaidOrder.timeline).toHaveLength(2);
  });

  it("supports refund failure recovery on cancel retry", async () => {
    const order = await createOrder();

    const paidOrderResponse = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-success-token",
        idempotencyKey: "cancel-flow-pay"
      }
    });
    expect(paidOrderResponse.statusCode).toBe(200);
    expect(orderSchema.parse(paidOrderResponse.json()).status).toBe("PAID");

    const rejectedRefundCancel = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/cancel`,
      payload: {
        reason: "please reject this refund"
      }
    });
    expect(rejectedRefundCancel.statusCode).toBe(409);
    expect(rejectedRefundCancel.json()).toMatchObject({ code: "REFUND_REJECTED" });

    const orderAfterRejectedRefund = await ordersApp.inject({
      method: "GET",
      url: `/v1/orders/${order.id}`
    });
    expect(orderAfterRejectedRefund.statusCode).toBe(200);
    expect(orderSchema.parse(orderAfterRejectedRefund.json()).status).toBe("PAID");

    const recoveredCancel = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/cancel`,
      payload: {
        reason: "customer changed mind"
      }
    });
    expect(recoveredCancel.statusCode).toBe(200);

    const canceledOrder = orderSchema.parse(recoveredCancel.json());
    expect(canceledOrder.status).toBe("CANCELED");

    const repeatedCancel = await ordersApp.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/cancel`,
      payload: {
        reason: "customer changed mind"
      }
    });
    expect(repeatedCancel.statusCode).toBe(200);
    expect(orderSchema.parse(repeatedCancel.json()).timeline).toHaveLength(canceledOrder.timeline.length);
  });
});
