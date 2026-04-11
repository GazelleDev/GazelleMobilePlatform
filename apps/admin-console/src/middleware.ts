import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  adminConsoleSessionCookieName,
  adminConsoleSessionMaxAgeSeconds,
  adminConsoleSessionRefreshThresholdMs
} from "@/lib/session-constants";

type InternalAdminSessionLike = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  admin: {
    internalAdminUserId: string;
    displayName: string;
    email: string;
    role: string;
    active: boolean;
    capabilities: string[];
    createdAt: string;
    updatedAt: string;
  };
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let cachedSessionKey:
  | {
      secret: string;
      keyPromise: Promise<CryptoKey>;
    }
  | undefined;

function readSessionSecret() {
  const value = process.env.ADMIN_CONSOLE_SESSION_SECRET?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readApiBaseUrl() {
  const value = process.env.INTERNAL_ADMIN_API_BASE_URL?.trim();
  if (!value) {
    return undefined;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function encodeBytesBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(value: string) {
  return encodeBytesBase64Url(textEncoder.encode(value));
}

function decodeBase64Url(value: string) {
  return textDecoder.decode(decodeBase64UrlToBytes(value));
}

function hasStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isInternalAdminSessionLike(value: unknown): value is InternalAdminSessionLike {
  if (!value || typeof value !== "object") {
    return false;
  }

  const session = value as Partial<InternalAdminSessionLike>;
  const admin = session.admin as Partial<InternalAdminSessionLike["admin"]> | undefined;

  return (
    typeof session.accessToken === "string" &&
    typeof session.refreshToken === "string" &&
    typeof session.expiresAt === "string" &&
    Boolean(admin) &&
    typeof admin?.internalAdminUserId === "string" &&
    typeof admin.displayName === "string" &&
    typeof admin.email === "string" &&
    typeof admin.role === "string" &&
    typeof admin.active === "boolean" &&
    hasStringArray(admin.capabilities) &&
    typeof admin.createdAt === "string" &&
    typeof admin.updatedAt === "string"
  );
}

function isSessionExpiringSoon(session: InternalAdminSessionLike) {
  const expiresAtMs = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs - Date.now() <= adminConsoleSessionRefreshThresholdMs;
}

function buildNextResponse() {
  return NextResponse.next();
}

function buildCookieHeader(
  request: NextRequest,
  input: {
    name: string;
    value?: string;
  }
) {
  const nextCookies = request.cookies.getAll().filter((cookie) => cookie.name !== input.name);
  if (input.value !== undefined) {
    nextCookies.push({
      name: input.name,
      value: input.value
    });
  }

  return nextCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function buildNextResponseWithCookieOverride(
  request: NextRequest,
  input: {
    name: string;
    value?: string;
  }
) {
  const requestHeaders = new Headers(request.headers);
  const cookieHeader = buildCookieHeader(request, input);
  if (cookieHeader) {
    requestHeaders.set("cookie", cookieHeader);
  } else {
    requestHeaders.delete("cookie");
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

function clearSessionCookie(request: NextRequest, response: NextResponse) {
  response.cookies.delete(adminConsoleSessionCookieName);
  return response;
}

async function getSessionKey(secret: string) {
  if (!cachedSessionKey || cachedSessionKey.secret !== secret) {
    cachedSessionKey = {
      secret,
      keyPromise: crypto.subtle.importKey(
        "raw",
        textEncoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      )
    };
  }

  return cachedSessionKey.keyPromise;
}

async function signPayload(payload: string, secret: string) {
  const key = await getSessionKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(payload));
  return encodeBytesBase64Url(new Uint8Array(signature));
}

async function parseSessionToken(token: string | undefined, secret: string) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }

  try {
    const key = await getSessionKey(secret);
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64UrlToBytes(signature),
      textEncoder.encode(payload)
    );

    if (!verified) {
      return null;
    }

    const parsed = JSON.parse(decodeBase64Url(payload)) as unknown;
    return isInternalAdminSessionLike(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function createSessionCookieValue(session: InternalAdminSessionLike, secret: string) {
  const payload = encodeBase64Url(JSON.stringify(session));
  return `${payload}.${await signPayload(payload, secret)}`;
}

async function rotateSession(session: InternalAdminSessionLike, apiBaseUrl: string) {
  const response = await fetch(`${apiBaseUrl}/v1/internal-admin/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      refreshToken: session.refreshToken
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const parsed = (await response.json()) as unknown;
  return isInternalAdminSessionLike(parsed) ? parsed : null;
}

export async function middleware(request: NextRequest) {
  const secret = readSessionSecret();
  const apiBaseUrl = readApiBaseUrl();

  if (!secret || !apiBaseUrl) {
    return buildNextResponse();
  }

  const token = request.cookies.get(adminConsoleSessionCookieName)?.value;
  const session = await parseSessionToken(token, secret);
  if (!token || !session) {
    if (!token) {
      return buildNextResponse();
    }

    return clearSessionCookie(
      request,
      buildNextResponseWithCookieOverride(request, {
        name: adminConsoleSessionCookieName
      })
    );
  }

  if (!isSessionExpiringSoon(session)) {
    return buildNextResponse();
  }

  const rotatedSession = await rotateSession(session, apiBaseUrl);
  if (!rotatedSession) {
    return clearSessionCookie(
      request,
      buildNextResponseWithCookieOverride(request, {
        name: adminConsoleSessionCookieName
      })
    );
  }

  const cookieValue = await createSessionCookieValue(rotatedSession, secret);
  const response = buildNextResponseWithCookieOverride(request, {
    name: adminConsoleSessionCookieName,
    value: cookieValue
  });
  response.cookies.set(adminConsoleSessionCookieName, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: adminConsoleSessionMaxAgeSeconds
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
