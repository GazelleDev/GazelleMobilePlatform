import { describe, expect, it } from "vitest";
import {
  DEFAULT_CUSTOMIZATION,
  addCartItem,
  buildPricingSummary,
  describeCustomization,
  getUnitPriceCents
} from "../src/cart/model";

const LARGE_SIZE = {
  groupId: "size",
  groupLabel: "Size",
  optionId: "large",
  optionLabel: "Large",
  priceDeltaCents: 100
} as const;

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

const EXTRA_SHOT = {
  groupId: "extra-shot",
  groupLabel: "Extra shot",
  optionId: "extra-shot",
  optionLabel: "Add shot",
  priceDeltaCents: 125
} as const;

describe("cart model", () => {
  it("merges line items with identical customization", () => {
    let items = addCartItem([], {
      menuItemId: "latte",
      name: "Latte",
      basePriceCents: 575,
      customization: { ...DEFAULT_CUSTOMIZATION, selectedOptions: [LARGE_SIZE] }
    });

    items = addCartItem(items, {
      menuItemId: "latte",
      name: "Latte",
      basePriceCents: 575,
      customization: { ...DEFAULT_CUSTOMIZATION, selectedOptions: [LARGE_SIZE] },
      quantity: 2
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);
  });

  it("creates separate lines for different customization", () => {
    let items = addCartItem([], {
      menuItemId: "latte",
      name: "Latte",
      basePriceCents: 575,
      customization: { ...DEFAULT_CUSTOMIZATION, selectedOptions: [WHOLE_MILK] }
    });

    items = addCartItem(items, {
      menuItemId: "latte",
      name: "Latte",
      basePriceCents: 575,
      customization: { ...DEFAULT_CUSTOMIZATION, selectedOptions: [OAT_MILK] }
    });

    expect(items).toHaveLength(2);
  });

  it("calculates customization price deltas and pricing summary", () => {
    const customizedPrice = getUnitPriceCents(575, {
      selectedOptions: [LARGE_SIZE, OAT_MILK, EXTRA_SHOT],
      notes: ""
    });

    expect(customizedPrice).toBe(875);
    const pricing = buildPricingSummary(1750, 600);
    expect(pricing.taxCents).toBe(105);
    expect(pricing.totalCents).toBe(1855);
  });

  it("formats customization descriptions", () => {
    const description = describeCustomization({
      selectedOptions: [
        LARGE_SIZE,
        {
          groupId: "milk",
          groupLabel: "Milk",
          optionId: "almond",
          optionLabel: "Almond milk",
          priceDeltaCents: 75
        },
        EXTRA_SHOT
      ],
      notes: "easy ice"
    });

    expect(description).toContain("Large");
    expect(description).toContain("Almond milk");
    expect(description).toContain("Add shot");
    expect(description).toContain("easy ice");
  });
});
