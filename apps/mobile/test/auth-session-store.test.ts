import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_STORAGE_KEY,
  clearStoredSession,
  isSessionExpiringSoon,
  loadStoredSession,
  parseStoredSession,
  persistSession,
  type AuthSession
} from "../src/auth/sessionStore";

const secureStoreMocks = vi.hoisted(() => ({
  getItemAsync: vi.fn<(key: string) => Promise<string | null>>(),
  setItemAsync: vi.fn<(key: string, value: string) => Promise<void>>(),
  deleteItemAsync: vi.fn<(key: string) => Promise<void>>()
}));

vi.mock("expo-secure-store", () => secureStoreMocks);

const sampleSession: AuthSession = {
  accessToken: "access-token",
  refreshToken: "refresh-token",
  expiresAt: "2030-01-01T00:00:00.000Z",
  userId: "123e4567-e89b-12d3-a456-426614174000"
};

describe("sessionStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses a valid stored session", () => {
    const raw = JSON.stringify(sampleSession);
    expect(parseStoredSession(raw)).toEqual(sampleSession);
  });

  it("returns null for invalid payloads", () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession("not-json")).toBeNull();
    expect(parseStoredSession(JSON.stringify({ accessToken: "x" }))).toBeNull();
  });

  it("detects near-expiry sessions", () => {
    const now = Date.parse("2030-01-01T00:00:00.000Z");
    const soon = { ...sampleSession, expiresAt: "2030-01-01T00:00:30.000Z" };
    const later = { ...sampleSession, expiresAt: "2030-01-01T00:05:00.000Z" };

    expect(isSessionExpiringSoon(soon, now)).toBe(true);
    expect(isSessionExpiringSoon(later, now)).toBe(false);
  });

  it("loads, persists, and clears secure storage entries", async () => {
    secureStoreMocks.getItemAsync.mockResolvedValueOnce(JSON.stringify(sampleSession));

    await expect(loadStoredSession()).resolves.toEqual(sampleSession);
    expect(secureStoreMocks.getItemAsync).toHaveBeenCalledWith(SESSION_STORAGE_KEY);

    await persistSession(sampleSession);
    expect(secureStoreMocks.setItemAsync).toHaveBeenCalledWith(SESSION_STORAGE_KEY, JSON.stringify(sampleSession));

    await clearStoredSession();
    expect(secureStoreMocks.deleteItemAsync).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
  });
});
