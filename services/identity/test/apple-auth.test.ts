import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { createSignedAppleIdentityToken, installAppleAuthEnv, installAppleAuthFetchMock } from "./apple-test-helpers.js";

describe("apple auth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("resolves repeated Apple exchanges with the same sub to one canonical user and distinct sessions", async () => {
    installAppleAuthEnv();
    installAppleAuthFetchMock();
    const app = await buildApp();
    const firstIdentityToken = createSignedAppleIdentityToken({
      sub: "apple-user-123",
      email: "owner@gazellecoffee.com",
      nonce: "apple-first"
    });
    const secondIdentityToken = createSignedAppleIdentityToken({
      sub: "apple-user-123",
      email: "owner@gazellecoffee.com",
      nonce: "apple-second"
    });

    const first = await app.inject({
      method: "POST",
      url: "/v1/auth/apple/exchange",
      payload: {
        identityToken: firstIdentityToken,
        authorizationCode: "auth-code",
        nonce: "apple-first"
      }
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/auth/apple/exchange",
      payload: {
        identityToken: secondIdentityToken,
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

  it("rejects Apple tokens whose audience does not match the configured app", async () => {
    installAppleAuthEnv();
    installAppleAuthFetchMock();
    const app = await buildApp();
    const identityToken = createSignedAppleIdentityToken({
      sub: "apple-user-invalid-audience",
      email: "owner@gazellecoffee.com",
      nonce: "apple-mismatch",
      aud: "com.example.wrong-app"
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

    await app.close();
  });

  it("returns a configuration error when Apple Sign-In env is missing", async () => {
    const app = await buildApp();
    const identityToken = "invalid.token.value";

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
      code: "APPLE_SIGN_IN_NOT_CONFIGURED"
    });

    await app.close();
  });

  it("revokes the stored Apple token before deleting the account", async () => {
    installAppleAuthEnv();
    const fetchMock = installAppleAuthFetchMock();
    const app = await buildApp();
    const identityToken = createSignedAppleIdentityToken({
      sub: "apple-user-delete",
      email: "member@example.com",
      nonce: "apple-delete"
    });

    const exchange = await app.inject({
      method: "POST",
      url: "/v1/auth/apple/exchange",
      payload: {
        identityToken,
        authorizationCode: "auth-code",
        nonce: "apple-delete"
      }
    });

    expect(exchange.statusCode).toBe(200);
    const session = exchange.json();

    const remove = await app.inject({
      method: "DELETE",
      url: "/v1/auth/account",
      headers: {
        authorization: `Bearer ${session.accessToken}`
      }
    });

    expect(remove.statusCode).toBe(200);
    expect(
      fetchMock.mock.calls.some(([url]) => {
        const target = typeof url === "string" ? url : url.url;
        return target === "https://appleid.apple.com/auth/revoke";
      })
    ).toBe(true);

    await app.close();
  });
});
