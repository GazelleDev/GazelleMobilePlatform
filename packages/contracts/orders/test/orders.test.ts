import { describe, expect, it } from "vitest";
import {
  orderPaymentContextSchema,
  orderStatusSchema,
  ordersPaymentReconciliationSchema,
  stripeMobilePaymentFinalizeResponseSchema,
  stripeMobilePaymentSessionResponseSchema,
  updateDiscountCodeRequestSchema
} from "../src";

describe("contracts-orders", () => {
  it("contains READY status", () => {
    expect(orderStatusSchema.options).toContain("READY");
  });

  it("accepts internal payment reconciliation payloads", () => {
    const parsed = ordersPaymentReconciliationSchema.parse({
      provider: "CLOVER",
      kind: "CHARGE",
      orderId: "123e4567-e89b-12d3-a456-426614174000",
      paymentId: "123e4567-e89b-12d3-a456-426614174001",
      status: "SUCCEEDED",
      occurredAt: "2026-03-11T00:00:00.000Z"
    });
    expect(parsed.kind).toBe("CHARGE");
  });

  it("accepts Stripe reconciliation payloads with provider-native identifiers", () => {
    const parsed = ordersPaymentReconciliationSchema.parse({
      provider: "STRIPE",
      kind: "REFUND",
      orderId: "123e4567-e89b-12d3-a456-426614174000",
      paymentId: "pi_3QxExample123",
      refundId: "re_3QxExample456",
      status: "REFUNDED",
      occurredAt: "2026-03-11T00:01:00.000Z"
    });
    expect(parsed.provider).toBe("STRIPE");
    expect(parsed.paymentId).toBe("pi_3QxExample123");
  });

  it("accepts Stripe mobile payment session responses", () => {
    const parsed = stripeMobilePaymentSessionResponseSchema.parse({
      orderId: "123e4567-e89b-12d3-a456-426614174000",
      paymentIntentId: "pi_3QxExample123",
      paymentIntentClientSecret: "pi_3QxExample123_secret_abc",
      publishableKey: "pk_test_123",
      stripeAccountId: "acct_123456789",
      merchantDisplayName: "Northside Coffee",
      merchantCountryCode: "US",
      amountCents: 1295,
      currency: "USD",
      applePayEnabled: true,
      cardEnabled: true
    });

    expect(parsed.paymentIntentId).toBe("pi_3QxExample123");
  });

  it("accepts Stripe mobile payment finalization responses", () => {
    const parsed = stripeMobilePaymentFinalizeResponseSchema.parse({
      orderId: "123e4567-e89b-12d3-a456-426614174000",
      paymentIntentId: "pi_3QxExample123",
      accepted: true,
      applied: true,
      orderStatus: "PAID"
    });

    expect(parsed.orderStatus).toBe("PAID");
  });

  it("accepts internal order payment context payloads", () => {
    const parsed = orderPaymentContextSchema.parse({
      orderId: "123e4567-e89b-12d3-a456-426614174000",
      locationId: "flagship-01",
      status: "PENDING_PAYMENT",
      total: {
        currency: "USD",
        amountCents: 1295
      }
    });

    expect(parsed.total.amountCents).toBe(1295);
  });

  it("accepts null fields when clearing optional discount-code rules", () => {
    const parsed = updateDiscountCodeRequestSchema.parse({
      locationId: "flagship-01",
      maxDiscountCents: null,
      maxTotalRedemptions: null,
      startsAt: null,
      expiresAt: null
    });

    expect(parsed).toMatchObject({
      maxDiscountCents: null,
      maxTotalRedemptions: null,
      startsAt: null,
      expiresAt: null
    });
  });
});
