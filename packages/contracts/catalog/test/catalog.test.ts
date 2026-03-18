import { describe, expect, it } from "vitest";
import {
  buildDefaultCustomizationInput,
  menuResponseSchema,
  priceMenuItemCustomization,
  resolveMenuItemCustomization,
  storeConfigResponseSchema
} from "../src";

const espressoGroups = [
  {
    id: "size",
    label: "Size",
    selectionType: "single" as const,
    required: true,
    options: [
      { id: "regular", label: "Regular", priceDeltaCents: 0, default: true },
      { id: "large", label: "Large", priceDeltaCents: 100 }
    ]
  },
  {
    id: "milk",
    label: "Milk",
    selectionType: "single" as const,
    required: true,
    options: [
      { id: "whole", label: "Whole milk", priceDeltaCents: 0, default: true },
      { id: "oat", label: "Oat milk", priceDeltaCents: 75 }
    ]
  },
  {
    id: "toppings",
    label: "Toppings",
    selectionType: "multiple" as const,
    minSelections: 0,
    maxSelections: 2,
    options: [
      { id: "cinnamon", label: "Cinnamon", priceDeltaCents: 25 },
      { id: "cold-foam", label: "Cold foam", priceDeltaCents: 150 }
    ]
  }
];

describe("contracts-catalog", () => {
  it("validates menu payload", () => {
    const payload = menuResponseSchema.parse({
      locationId: "flagship-01",
      currency: "USD",
      categories: [
        {
          id: "coffee",
          title: "Coffee",
          items: [
            {
              id: "latte",
              name: "Latte",
              description: "Espresso with steamed milk.",
              priceCents: 575,
              badgeCodes: ["popular"],
              visible: true
            }
          ]
        }
      ]
    });

    expect(payload.currency).toBe("USD");
    expect(payload.categories[0]?.items[0]?.name).toBe("Latte");
  });

  it("validates store config payload", () => {
    const config = storeConfigResponseSchema.parse({
      locationId: "flagship-01",
      prepEtaMinutes: 12,
      taxRateBasisPoints: 600,
      pickupInstructions: "Pickup at the flagship order counter."
    });

    expect(config.taxRateBasisPoints).toBe(600);
  });

  it("rejects invalid store tax rate", () => {
    expect(() =>
      storeConfigResponseSchema.parse({
        locationId: "flagship-01",
        prepEtaMinutes: 12,
        taxRateBasisPoints: 10001,
        pickupInstructions: "Pickup at the flagship order counter."
      })
    ).toThrow();
  });

  it("builds defaults for required single-select groups", () => {
    const defaults = buildDefaultCustomizationInput(espressoGroups);

    expect(defaults.selectedOptions).toEqual([
      { groupId: "milk", optionId: "whole" },
      { groupId: "size", optionId: "regular" }
    ]);
  });

  it("accepts valid required single-select selections", () => {
    const resolved = resolveMenuItemCustomization({
      groups: espressoGroups,
      selection: {
        selectedOptions: [
          { groupId: "size", optionId: "large" },
          { groupId: "milk", optionId: "oat" }
        ]
      }
    });

    expect(resolved.valid).toBe(true);
    expect(resolved.customizationDeltaCents).toBe(175);
  });

  it("rejects missing required groups", () => {
    const resolved = resolveMenuItemCustomization({
      groups: espressoGroups,
      selection: {
        selectedOptions: [{ groupId: "size", optionId: "large" }]
      }
    });

    expect(resolved.valid).toBe(false);
    expect(resolved.issues.some((issue) => issue.code === "group_missing_required" && issue.groupId === "milk")).toBe(true);
  });

  it("accepts valid multi-select groups within limits", () => {
    const resolved = resolveMenuItemCustomization({
      groups: espressoGroups,
      selection: {
        selectedOptions: [
          { groupId: "size", optionId: "regular" },
          { groupId: "milk", optionId: "whole" },
          { groupId: "toppings", optionId: "cinnamon" },
          { groupId: "toppings", optionId: "cold-foam" }
        ]
      }
    });

    expect(resolved.valid).toBe(true);
    expect(resolved.customizationDeltaCents).toBe(175);
  });

  it("rejects selections over maxSelections", () => {
    const resolved = resolveMenuItemCustomization({
      groups: [
        {
          id: "extras",
          label: "Extras",
          selectionType: "multiple" as const,
          maxSelections: 1,
          options: [
            { id: "one", label: "One", priceDeltaCents: 50 },
            { id: "two", label: "Two", priceDeltaCents: 75 }
          ]
        }
      ],
      selection: {
        selectedOptions: [
          { groupId: "extras", optionId: "one" },
          { groupId: "extras", optionId: "two" }
        ]
      }
    });

    expect(resolved.valid).toBe(false);
    expect(resolved.issues.some((issue) => issue.code === "group_above_max")).toBe(true);
  });

  it("prices multiple option deltas and quantity", () => {
    const priced = priceMenuItemCustomization({
      basePriceCents: 675,
      quantity: 3,
      groups: espressoGroups,
      selection: {
        selectedOptions: [
          { groupId: "size", optionId: "large" },
          { groupId: "milk", optionId: "oat" },
          { groupId: "toppings", optionId: "cinnamon" }
        ]
      }
    });

    expect(priced.unitPriceCents).toBe(875);
    expect(priced.lineTotalCents).toBe(2625);
  });

  it("supports items with no customization groups", () => {
    const resolved = resolveMenuItemCustomization({
      groups: [],
      selection: {
        notes: "warm it up"
      }
    });

    expect(resolved.valid).toBe(true);
    expect(resolved.groupSelections).toEqual([]);
    expect(resolved.customizationDeltaCents).toBe(0);
    expect(resolved.input.notes).toBe("warm it up");
  });
});
