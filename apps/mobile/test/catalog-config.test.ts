import { describe, expect, it } from "vitest";
import { resolveAppConfigData } from "../src/menu/catalog";

describe("mobile catalog config", () => {
  it("falls back to the default brand config when app-config is unavailable", () => {
    const config = resolveAppConfigData(undefined);

    expect(config.brand.brandName).toBe("Gazelle Coffee");
    expect(config.enabledTabs).toEqual(["home", "menu", "orders", "account"]);
    expect(config.paymentCapabilities.applePay).toBe(true);
    expect(config.fulfillment.mode).toBe("time_based");
  });
});
