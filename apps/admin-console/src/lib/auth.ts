import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type AdminConsoleRole = "platform_owner" | "platform_operator";

export type AdminConsoleSession = {
  email: string;
  role: AdminConsoleRole;
  expiresAt: string;
};

const sessionCookieName = "admin_console_session";
const sessionMaxAgeSeconds = 60 * 60 * 12;

function trimToUndefined(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

function splitEnvList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(/[\n,]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0)
  );
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getAuthConfig() {
  const allowedEmails = splitEnvList(process.env.ADMIN_CONSOLE_ALLOWED_EMAILS);
  const ownerEmails = splitEnvList(process.env.ADMIN_CONSOLE_OWNER_EMAILS);
  const sharedPassword = trimToUndefined(process.env.ADMIN_CONSOLE_SHARED_PASSWORD);
  const sessionSecret = trimToUndefined(process.env.ADMIN_CONSOLE_SESSION_SECRET);

  return {
    allowedEmails,
    ownerEmails,
    sharedPassword,
    sessionSecret
  };
}

function getRequiredSessionSecret() {
  const { sessionSecret } = getAuthConfig();
  if (!sessionSecret) {
    throw new Error("ADMIN_CONSOLE_SESSION_SECRET must be configured.");
  }

  return sessionSecret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getRequiredSessionSecret()).update(payload).digest("base64url");
}

function createSessionToken(session: AdminConsoleSession) {
  const payload = encodeBase64Url(JSON.stringify(session));
  return `${payload}.${signPayload(payload)}`;
}

function parseSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEquals(signPayload(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as AdminConsoleSession;
    if (!parsed.email || !parsed.role || !parsed.expiresAt) {
      return null;
    }

    if (Date.parse(parsed.expiresAt) <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function resolveRole(email: string): AdminConsoleRole {
  const { ownerEmails } = getAuthConfig();
  return ownerEmails.has(normalizeEmail(email)) ? "platform_owner" : "platform_operator";
}

export function getAdminConsoleAuthStatus() {
  const { allowedEmails, ownerEmails, sharedPassword, sessionSecret } = getAuthConfig();

  return {
    configured: allowedEmails.size > 0 && Boolean(sharedPassword) && Boolean(sessionSecret),
    allowedEmails: Array.from(allowedEmails),
    ownerEmails: Array.from(ownerEmails),
    hasSharedPassword: Boolean(sharedPassword),
    hasSessionSecret: Boolean(sessionSecret)
  };
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return parseSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/sign-in?error=Please sign in to continue.");
  }

  return session;
}

export async function setAdminSession(session: AdminConsoleSession) {
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, createSessionToken(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export function validateAdminCredentials(input: { email: string; password: string }) {
  const { allowedEmails, sharedPassword, sessionSecret } = getAuthConfig();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!sessionSecret || !sharedPassword || allowedEmails.size === 0) {
    return {
      ok: false as const,
      message: "Admin console auth is not configured yet."
    };
  }

  if (!allowedEmails.has(email) || !safeEquals(sharedPassword, password)) {
    return {
      ok: false as const,
      message: "Email or password is invalid."
    };
  }

  return {
    ok: true as const,
    session: {
      email,
      role: resolveRole(email),
      expiresAt: new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString()
    }
  };
}
