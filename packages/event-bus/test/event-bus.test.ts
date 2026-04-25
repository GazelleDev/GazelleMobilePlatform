import { describe, it, expect } from "vitest";
import { type Order } from "@lattelink/contracts-orders";
import {
  orderEventSchema,
  orderStatusChannel,
  orderEventsChannel,
  type OrderEvent
} from "../src/index.js";

describe("channel helpers", () => {
  it("builds order status channel", () => {
    expect(orderStatusChannel("order-123")).toBe("order_status:order-123");
  });

  it("builds order events channel", () => {
    expect(orderEventsChannel("loc-456")).toBe("order_events:loc-456");
  });
});

describe("orderEventSchema", () => {
  const validOrder: Order = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    locationId: "loc-1",
    status: "IN_PREP",
    items: [],
    total: { currency: "USD", amountCents: 530 },
    pickupCode: "A1B",
    timeline: [
      {
        status: "IN_PREP",
        occurredAt: "2024-01-01T00:00:00.000Z"
      }
    ]
  };
  const validEvent: OrderEvent = {
    userId: "user-1",
    order: validOrder
  };

  it("parses a valid event", () => {
    expect(orderEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("rejects event with missing order", () => {
    const input = { ...validEvent, order: undefined };
    expect(orderEventSchema.safeParse(input).success).toBe(false);
  });

  it("rejects event with missing userId", () => {
    const input = { ...validEvent, userId: undefined };
    expect(orderEventSchema.safeParse(input).success).toBe(false);
  });

  it("rejects non-object", () => {
    expect(orderEventSchema.safeParse("not-an-object").success).toBe(false);
    expect(orderEventSchema.safeParse(null).success).toBe(false);
    expect(orderEventSchema.safeParse(42).success).toBe(false);
  });
});
