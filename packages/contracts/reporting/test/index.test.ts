import { describe, expect, it } from "vitest";
import { reportingQueryRequestSchema } from "../src/index.js";

describe("reporting contract", () => {
  it("accepts local reporting boundaries and rejects browser offsets or the retired timezone field", () => {
    expect(reportingQueryRequestSchema.parse({ start: "2026-03-08", end: "2026-03-09" })).toMatchObject({ granularity: "day" });
    expect(() => reportingQueryRequestSchema.parse({ start: "2026-03-08T00:00:00Z", end: "2026-03-09T00:00:00Z" })).toThrow();
    expect(() => reportingQueryRequestSchema.parse({ start: "2026-03-08", end: "2026-03-09", timezone: "America/Detroit" })).toThrow();
  });
});
