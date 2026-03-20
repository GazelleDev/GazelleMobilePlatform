import { describe, expect, it } from "vitest";
import {
  canManageOrderStatus,
  filterActiveOrders,
  formatOrderStatus,
  getAppConfigCapabilityLabels,
  getOrderActions,
  getOrderCustomerLabel,
  isActiveOrder,
  normalizeMenuItemForm,
  normalizeStoreConfigForm,
  resolveAppConfig,
  resolveOrder
} from "../src/model";

const sampleOrder = resolveOrder({
  id: "123e4567-e89b-12d3-a456-426614174000",
  locationId: "flagship-01",
  status: "PAID",
  items: [],
  total: { currency: "USD", amountCents: 1200 },
  pickupCode: "A1B2C3",
  timeline: [{ status: "PENDING_PAYMENT", occurredAt: "2026-03-20T00:00:00.000Z" }],
  customer: {
    name: "Jordan Lee",
    email: "jordan@example.com",
    phone: "555-0101"
  }
});

const sampleAppConfig = resolveAppConfig({
  brand: {
    brandId: "gazelle-default",
    brandName: "Gazelle Coffee",
    locationId: "flagship-01",
    locationName: "Gazelle Coffee Flagship",
    marketLabel: "Ann Arbor, MI"
  },
  theme: {
    background: "#F7F4ED",
    backgroundAlt: "#F0ECE4",
    surface: "#FFFDF8",
    surfaceMuted: "#F3EFE7",
    foreground: "#171513",
    foregroundMuted: "#605B55",
    muted: "#9B9389",
    border: "rgba(23, 21, 19, 0.08)",
    primary: "#1E1B18",
    accent: "#2D2823",
    fontFamily: "System",
    displayFontFamily: "Fraunces"
  },
  enabledTabs: ["home", "orders"],
  featureFlags: {
    loyalty: false,
    pushNotifications: false,
    refunds: false,
    orderTracking: true,
    staffDashboard: true,
    menuEditing: true
  },
  loyaltyEnabled: true,
  paymentCapabilities: {
    applePay: true,
    card: true,
    cash: false,
    refunds: true,
    clover: {
      enabled: true,
      merchantRef: "flagship-01"
    }
  },
  fulfillment: {
    mode: "staff",
    timeBasedScheduleMinutes: {
      inPrep: 5,
      ready: 10,
      completed: 15
    }
  }
});

describe("operator-web model", () => {
  it("derives staff actions and active-order filtering from status", () => {
    expect(getOrderActions(sampleOrder, "staff").map((action) => action.status)).toEqual(["IN_PREP"]);
    expect(getOrderActions({ ...sampleOrder, status: "IN_PREP" }, "staff").map((action) => action.status)).toEqual([
      "READY"
    ]);
    expect(getOrderActions({ ...sampleOrder, status: "READY" }, "staff").map((action) => action.status)).toEqual([
      "COMPLETED"
    ]);
    expect(getOrderActions(sampleOrder, "time_based")).toEqual([]);
    expect(canManageOrderStatus(sampleAppConfig)).toBe(true);
    expect(
      canManageOrderStatus({
        ...sampleAppConfig,
        fulfillment: {
          ...sampleAppConfig.fulfillment,
          mode: "time_based"
        }
      })
    ).toBe(false);

    expect(isActiveOrder(sampleOrder)).toBe(true);
    expect(isActiveOrder({ ...sampleOrder, status: "COMPLETED" })).toBe(false);
    expect(filterActiveOrders([sampleOrder, { ...sampleOrder, status: "COMPLETED" }]).map((order) => order.status)).toEqual([
      "PAID"
    ]);
  });

  it("formats order statuses and customer labels", () => {
    expect(formatOrderStatus("IN_PREP")).toBe("IN PREP");
    expect(getOrderCustomerLabel(sampleOrder)).toBe("Jordan Lee · jordan@example.com · 555-0101");
    expect(getOrderCustomerLabel({ ...sampleOrder, customer: undefined })).toBe("Customer details unavailable");
  });

  it("derives capability labels from runtime app config", () => {
    expect(getAppConfigCapabilityLabels(sampleAppConfig)).toEqual([
      "Apple Pay",
      "Card",
      "Refunds",
      "Clover",
      "Loyalty",
      "Staff fulfillment",
      "Order tracking",
      "Staff dashboard",
      "Menu editing",
      "home tab",
      "orders tab"
    ]);
  });

  it("normalizes menu and store form inputs before submission", () => {
    expect(
      normalizeMenuItemForm({
        name: "  Brown Sugar Latte  ",
        priceCents: "1250",
        visible: "yes"
      })
    ).toEqual({
      name: "Brown Sugar Latte",
      priceCents: 1250,
      visible: true
    });

    expect(
      normalizeStoreConfigForm({
        storeName: "  Gazelle Coffee Flagship  ",
        hours: "  Daily · 7:00 AM - 6:00 PM  ",
        pickupInstructions: "  Pickup at the front counter.  "
      })
    ).toEqual({
      storeName: "Gazelle Coffee Flagship",
      hours: "Daily · 7:00 AM - 6:00 PM",
      pickupInstructions: "Pickup at the front counter."
    });
  });
});
