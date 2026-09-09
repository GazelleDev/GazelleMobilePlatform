import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerRoutes } from "../src/routes.js";
import type { ReportingRepository } from "../src/repository.js";

const bounds = {
  currentStart: "2026-03-08T05:00:00.000Z", currentEnd: "2026-03-09T04:00:00.000Z",
  previousStart: "2026-03-07T05:00:00.000Z", previousEnd: "2026-03-08T05:00:00.000Z"
};

function repository(timezones: string[]): ReportingRepository {
  return {
    close: async () => {},
    pingDb: async () => {},
    getLocations: async (locationIds) => locationIds.map((locationId, index) => ({ locationId, locationName: locationId, timezone: timezones[index] ?? timezones[0]! })),
    resolveBounds: async () => bounds,
    aggregate: async () => [],
    listCurrentBuckets: async () => [{ start: bounds.currentStart, end: bounds.currentEnd }]
  };
}

describe("reporting internal API", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns a typed structured error for a mixed-timezone aggregate", async () => {
    vi.stubEnv("GATEWAY_INTERNAL_API_TOKEN", "gateway-test-token");
    const app = Fastify();
    await registerRoutes(app, repository(["America/Detroit", "America/Chicago"]));
    const response = await app.inject({
      method: "POST",
      url: "/v1/reporting/query",
      headers: { "x-gateway-token": "gateway-test-token" },
      payload: { locationIds: ["loc-a", "loc-b"], start: "2026-03-08", end: "2026-03-09" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "MIXED_REPORTING_TIMEZONES" });
    await app.close();
  });

  it("responds on /health and /ready", async () => {
    const app = Fastify();
    await registerRoutes(app, repository(["America/Detroit"]));

    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/ready" })).json()).toMatchObject({
      status: "ready",
      service: "reporting",
      persistence: "postgres"
    });
    await app.close();
  });
});
