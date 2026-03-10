import { describe, expect, it } from "vitest";
import { orderQuoteSchema, orderSchema } from "@gazelle/contracts-orders";
import { buildApp } from "../src/app.js";

const sampleQuotePayload = {
  locationId: "flagship-01",
  items: [
    { itemId: "latte", quantity: 2 },
    { itemId: "croissant", quantity: 1 }
  ],
  pointsToRedeem: 125
};

describe("orders service", () => {
  it("responds on /health", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("creates quote and order, then exposes get/list lifecycle endpoints", async () => {
    const app = await buildApp();

    const quoteResponse = await app.inject({
      method: "POST",
      url: "/v1/orders/quote",
      payload: sampleQuotePayload
    });
    expect(quoteResponse.statusCode).toBe(200);
    const quote = orderQuoteSchema.parse(quoteResponse.json());
    expect(quote.total.amountCents).toBeGreaterThan(0);

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/orders",
      payload: {
        quoteId: quote.quoteId,
        quoteHash: quote.quoteHash
      }
    });
    expect(createResponse.statusCode).toBe(200);
    const order = orderSchema.parse(createResponse.json());
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(order.timeline).toHaveLength(1);

    const getResponse = await app.inject({
      method: "GET",
      url: `/v1/orders/${order.id}`
    });
    expect(getResponse.statusCode).toBe(200);
    expect(orderSchema.parse(getResponse.json()).id).toBe(order.id);

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/orders"
    });
    expect(listResponse.statusCode).toBe(200);
    const listed = listResponse.json() as Array<{ id: string }>;
    expect(listed.some((entry) => entry.id === order.id)).toBe(true);

    await app.close();
  });

  it("treats create and pay operations as idempotent", async () => {
    const app = await buildApp();
    const quoteResponse = await app.inject({
      method: "POST",
      url: "/v1/orders/quote",
      payload: sampleQuotePayload
    });
    const quote = orderQuoteSchema.parse(quoteResponse.json());

    const createPayload = {
      quoteId: quote.quoteId,
      quoteHash: quote.quoteHash
    };

    const firstCreate = await app.inject({
      method: "POST",
      url: "/v1/orders",
      payload: createPayload
    });
    const secondCreate = await app.inject({
      method: "POST",
      url: "/v1/orders",
      payload: createPayload
    });

    expect(firstCreate.statusCode).toBe(200);
    expect(secondCreate.statusCode).toBe(200);

    const createdOrder = orderSchema.parse(firstCreate.json());
    const secondOrder = orderSchema.parse(secondCreate.json());
    expect(secondOrder.id).toBe(createdOrder.id);

    const firstPay = await app.inject({
      method: "POST",
      url: `/v1/orders/${createdOrder.id}/pay`,
      payload: {
        applePayToken: "apple-pay-token",
        idempotencyKey: "pay-1"
      }
    });
    const secondPay = await app.inject({
      method: "POST",
      url: `/v1/orders/${createdOrder.id}/pay`,
      payload: {
        applePayToken: "apple-pay-token",
        idempotencyKey: "pay-1"
      }
    });

    const paidOrder = orderSchema.parse(firstPay.json());
    const paidOrderRepeat = orderSchema.parse(secondPay.json());

    expect(firstPay.statusCode).toBe(200);
    expect(secondPay.statusCode).toBe(200);
    expect(paidOrder.status).toBe("PAID");
    expect(paidOrderRepeat.timeline).toHaveLength(paidOrder.timeline.length);
    expect(paidOrder.timeline).toHaveLength(2);

    await app.close();
  });

  it("rejects mismatched quote hashes and blocks payment after cancellation", async () => {
    const app = await buildApp();
    const quoteResponse = await app.inject({
      method: "POST",
      url: "/v1/orders/quote",
      payload: sampleQuotePayload
    });
    const quote = orderQuoteSchema.parse(quoteResponse.json());

    const mismatchedCreate = await app.inject({
      method: "POST",
      url: "/v1/orders",
      payload: {
        quoteId: quote.quoteId,
        quoteHash: "incorrect-hash"
      }
    });
    expect(mismatchedCreate.statusCode).toBe(409);
    expect(mismatchedCreate.json()).toMatchObject({ code: "QUOTE_HASH_MISMATCH" });

    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/orders",
      payload: {
        quoteId: quote.quoteId,
        quoteHash: quote.quoteHash
      }
    });
    const order = orderSchema.parse(createResponse.json());

    const cancelResponse = await app.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/cancel`,
      payload: { reason: "changed mind" }
    });
    const canceledOrder = orderSchema.parse(cancelResponse.json());
    expect(canceledOrder.status).toBe("CANCELED");

    const repeatedCancel = await app.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/cancel`,
      payload: { reason: "still changed mind" }
    });
    const repeatedCanceledOrder = orderSchema.parse(repeatedCancel.json());
    expect(repeatedCanceledOrder.timeline).toHaveLength(canceledOrder.timeline.length);

    const payCanceledOrder = await app.inject({
      method: "POST",
      url: `/v1/orders/${order.id}/pay`,
      payload: {
        applePayToken: "apple-pay-token",
        idempotencyKey: "pay-after-cancel"
      }
    });
    expect(payCanceledOrder.statusCode).toBe(409);
    expect(payCanceledOrder.json()).toMatchObject({ code: "ORDER_NOT_PAYABLE" });

    await app.close();
  });
});
