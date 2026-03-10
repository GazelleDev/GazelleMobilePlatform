import { describe, expect, it } from "vitest";
import { createCartItem, DEFAULT_CUSTOMIZATION } from "../src/cart/model";
import { createCheckoutIdempotencyKey, createDemoApplePayToken, toQuoteItems } from "../src/orders/checkout";

describe("checkout helpers", () => {
  it("aggregates cart lines by menu item id for quote input", () => {
    const items = [
      createCartItem({
        menuItemId: "latte",
        name: "Latte",
        basePriceCents: 575,
        customization: { ...DEFAULT_CUSTOMIZATION, milk: "Whole" },
        quantity: 1
      }),
      createCartItem({
        menuItemId: "latte",
        name: "Latte",
        basePriceCents: 575,
        customization: { ...DEFAULT_CUSTOMIZATION, milk: "Oat" },
        quantity: 2
      }),
      createCartItem({
        menuItemId: "croissant",
        name: "Croissant",
        basePriceCents: 425,
        customization: DEFAULT_CUSTOMIZATION,
        quantity: 3
      })
    ];

    expect(toQuoteItems(items)).toEqual([
      { itemId: "latte", quantity: 3 },
      { itemId: "croissant", quantity: 3 }
    ]);
  });

  it("creates prefixed idempotency keys", () => {
    const key = createCheckoutIdempotencyKey();
    expect(key.startsWith("mobile-checkout-")).toBe(true);
  });

  it("creates prefixed demo Apple Pay tokens", () => {
    const token = createDemoApplePayToken();
    expect(token.startsWith("apple-pay-token-")).toBe(true);
  });
});
