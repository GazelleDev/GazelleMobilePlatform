import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";

function createFakeJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }), "utf8").toString("base64url");
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${header}.${body}.signature`;
}

describe("apple auth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("resolves repeated Apple exchanges with the same sub to one canonical user and distinct sessions", async () => {
    const app = await buildApp();
    const identityToken = createFakeJwt({
      sub: "apple-user-123",
      email: "owner@gazellecoffee.com"
    });

    const first = await app.inject({
      method: "POST",
      url: "/v1/auth/apple/exchange",
      payload: {
        identityToken,
        authorizationCode: "auth-code",
        nonce: "apple-first"
      }
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/auth/apple/exchange",
      payload: {
        identityToken,
        authorizationCode: "auth-code",
        nonce: "apple-second"
      }
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().userId).toBe(second.json().userId);
    expect(first.json().accessToken).not.toBe(second.json().accessToken);
    expect(first.json().refreshToken).not.toBe(second.json().refreshToken);

    await app.close();
  });

  it("falls back to the compatibility user and warns when Apple token has no sub", async () => {
    const app = await buildApp();
    const warnSpy = vi.spyOn(app.log, "warn");
    const identityToken = createFakeJwt({
      email: "owner@gazellecoffee.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/apple/exchange",
      payload: {
        identityToken,
        authorizationCode: "auth-code",
        nonce: "apple-missing-sub"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: "INVALID_APPLE_IDENTITY"
    });
    expect(warnSpy).toHaveBeenCalled();

    await app.close();
  });

  it("fails closed when Apple verification is explicitly enabled", async () => {
    vi.stubEnv("APPLE_SIGN_IN_VERIFY", "true");
    const app = await buildApp();
    const identityToken = createFakeJwt({
      sub: "apple-user-verify"
    });

    const response = await app.inject({
      method: "POST",
      url: "/v1/auth/apple/exchange",
      payload: {
        identityToken,
        authorizationCode: "auth-code",
        nonce: "apple-verify"
      }
    });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      code: "APPLE_VERIFICATION_UNAVAILABLE"
    });

    await app.close();
  });
});
