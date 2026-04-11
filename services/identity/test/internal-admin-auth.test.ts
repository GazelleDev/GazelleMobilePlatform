import { describe, expect, it } from "vitest";
import type { MailSender } from "../src/mail.js";
import { buildApp } from "../src/app.js";
import { createInMemoryIdentityRepository } from "../src/repository.js";

function createCapturingMailSender() {
  const sender: MailSender = {
    async sendMagicLink() {
      // internal-admin password/session tests do not rely on outbound delivery
    }
  };

  return { sender };
}

async function signInInternalAdmin(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string) {
  const response = await app.inject({
    method: "POST",
    url: "/v1/internal-admin/auth/sign-in",
    payload: {
      email,
      password
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json();
}

describe("internal admin auth", () => {
  it("supports refresh rotation and invalidates prior internal admin access tokens after logout", async () => {
    const repository = createInMemoryIdentityRepository();
    const { sender } = createCapturingMailSender();
    const app = await buildApp({ repository, mailSender: sender });

    const session = await signInInternalAdmin(app, "admin@gazellecoffee.com", "GazelleAdmin123!");

    const me = await app.inject({
      method: "GET",
      url: "/v1/internal-admin/auth/me",
      headers: {
        authorization: `Bearer ${session.accessToken}`
      }
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      email: "admin@gazellecoffee.com",
      role: "platform_owner"
    });

    const refresh = await app.inject({
      method: "POST",
      url: "/v1/internal-admin/auth/refresh",
      payload: {
        refreshToken: session.refreshToken
      }
    });
    expect(refresh.statusCode).toBe(200);
    const rotatedSession = refresh.json();
    expect(rotatedSession.accessToken).not.toBe(session.accessToken);
    expect(rotatedSession.refreshToken).not.toBe(session.refreshToken);

    const oldSessionMe = await app.inject({
      method: "GET",
      url: "/v1/internal-admin/auth/me",
      headers: {
        authorization: `Bearer ${session.accessToken}`
      }
    });
    expect(oldSessionMe.statusCode).toBe(401);

    const refreshedMe = await app.inject({
      method: "GET",
      url: "/v1/internal-admin/auth/me",
      headers: {
        authorization: `Bearer ${rotatedSession.accessToken}`
      }
    });
    expect(refreshedMe.statusCode).toBe(200);

    const logout = await app.inject({
      method: "POST",
      url: "/v1/internal-admin/auth/logout",
      payload: {
        refreshToken: rotatedSession.refreshToken
      }
    });
    expect(logout.statusCode).toBe(200);

    const postLogoutMe = await app.inject({
      method: "GET",
      url: "/v1/internal-admin/auth/me",
      headers: {
        authorization: `Bearer ${rotatedSession.accessToken}`
      }
    });
    expect(postLogoutMe.statusCode).toBe(401);

    await app.close();
  });

  it("rejects invalid internal admin credentials", async () => {
    const repository = createInMemoryIdentityRepository();
    const { sender } = createCapturingMailSender();
    const app = await buildApp({ repository, mailSender: sender });

    const response = await app.inject({
      method: "POST",
      url: "/v1/internal-admin/auth/sign-in",
      payload: {
        email: "admin@gazellecoffee.com",
        password: "wrong-password"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      code: "INVALID_INTERNAL_ADMIN_CREDENTIALS"
    });

    await app.close();
  });
});
