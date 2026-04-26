import { describe, expect, it } from "vitest";
import { isMobileLoyaltyVisible, isMobileOrderTrackingEnabled, resolveAppConfigData, resolveMenuImageUrl } from "../src/menu/catalog";

describe("mobile catalog config", () => {
  it("falls back to the default brand config when app-config is unavailable", () => {
    const config = resolveAppConfigData(undefined);

    expect(config.brand.brandId).toBe("rawaqcoffee");
    expect(config.brand.locationId).toBe("rawaqcoffee01");
    expect(config.brand.brandName).toBe("Rawaq Coffee");
    expect(config.enabledTabs).toEqual(["home", "menu", "orders", "account"]);
    expect(config.paymentCapabilities.applePay).toBe(true);
    expect(config.paymentCapabilities.card).toBe(true);
    expect(config.storeCapabilities.menu.source).toBe("platform_managed");
    expect(config.fulfillment.mode).toBe("time_based");
  });

  it("uses store capabilities as the runtime source of truth", () => {
    const config = resolveAppConfigData({
      ...resolveAppConfigData(undefined),
      storeCapabilities: {
        menu: {
          source: "external_sync"
        },
        operations: {
          fulfillmentMode: "staff",
          liveOrderTrackingEnabled: false,
          dashboardEnabled: false
        },
        loyalty: {
          visible: false
        }
      }
    });

    expect(isMobileLoyaltyVisible(config)).toBe(false);
    expect(isMobileOrderTrackingEnabled(config)).toBe(false);
    expect(config.featureFlags.menuEditing).toBe(false);
    expect(config.fulfillment.mode).toBe("staff");
  });

  it("resolves optimized mobile menu image variants from original media URLs", () => {
    const original =
      "https://media.nomly.us/brands/rawaqcoffee/locations/rawaqcoffee01/menu-items/latte/original/2026-04-24T03-18-42-279Z-447a193e-latte.png";

    expect(resolveMenuImageUrl(original, "list")).toBe(
      "https://media.nomly.us/brands/rawaqcoffee/locations/rawaqcoffee01/menu-items/latte/mobile-list/2026-04-24T03-18-42-279Z-447a193e-latte.jpg"
    );
    expect(resolveMenuImageUrl(original, "hero")).toBe(
      "https://media.nomly.us/brands/rawaqcoffee/locations/rawaqcoffee01/menu-items/latte/mobile-hero/2026-04-24T03-18-42-279Z-447a193e-latte.jpg"
    );
  });
});
