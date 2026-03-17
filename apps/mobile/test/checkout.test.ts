import { describe, expect, it } from "vitest";
import { createCartItem, DEFAULT_CUSTOMIZATION } from "../src/cart/model";
import { createCheckoutIdempotencyKey, createDemoApplePayToken, toQuoteItems } from "../src/orders/checkout";

const WHOLE_MILK = {
  groupId: "milk",
  groupLabel: "Milk",
  optionId: "whole",
  optionLabel: "Whole milk",
  priceDeltaCents: 0
} as const;

const OAT_MILK = {
  groupId: "milk",
  groupLabel: "Milk",
  optionId: "oat",
  optionLabel: "Oat milk",
  priceDeltaCents: 75
} as const;

describe("checkout helpers", () => {
  it("aggregates cart lines by menu item id for quote input", () => {
    const items = [
      createCartItem({
        menuItemId: "latte",
        name: "Latte",
        basePriceCents: 575,
        customization: { ...DEFAULT_CUSTOMIZATION, selectedOptions: [WHOLE_MILK] },
        quantity: 1
      }),
      createCartItem({
        menuItemId: "latte",
        name: "Latte",
        basePriceCents: 575,
        customization: { ...DEFAULT_CUSTOMIZATION, selectedOptions: [OAT_MILK] },
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
