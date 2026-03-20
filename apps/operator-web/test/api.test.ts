import { describe, expect, it } from "vitest";
import {
  buildStaffHeaders,
  extractApiErrorMessage,
  normalizeApiBaseUrl
} from "../src/api";

describe("operator-web api helpers", () => {
  it("normalizes operator api base URLs onto /v1", () => {
    expect(normalizeApiBaseUrl("http://127.0.0.1:8080")).toBe("http://127.0.0.1:8080/v1");
    expect(normalizeApiBaseUrl("http://127.0.0.1:8080/")).toBe("http://127.0.0.1:8080/v1");
    expect(normalizeApiBaseUrl("http://127.0.0.1:8080/v1")).toBe("http://127.0.0.1:8080/v1");
  });

  it("builds the dual staff-token plus bearer headers", () => {
    expect(buildStaffHeaders("operator-token", true)).toEqual({
      authorization: "Bearer operator-token",
      "x-staff-token": "operator-token",
      "content-type": "application/json"
    });
  });

  it("prefers upstream error messages when present", () => {
    expect(extractApiErrorMessage({ message: "Gateway token is invalid" }, 401)).toBe("Gateway token is invalid");
    expect(extractApiErrorMessage({}, 503)).toBe("Request failed (503)");
  });
});
