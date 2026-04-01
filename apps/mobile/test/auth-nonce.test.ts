import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAuthNonce } from "../src/auth/nonce";

const expoCryptoMocks = vi.hoisted(() => ({
  randomUUID: vi.fn<() => string>(),
  getRandomBytes: vi.fn<(byteCount: number) => Uint8Array>()
}));

vi.mock("expo-crypto", () => expoCryptoMocks);

describe("generateAuthNonce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses expo-crypto randomUUID when available", () => {
    expoCryptoMocks.randomUUID.mockReturnValue("nonce-uuid");

    expect(generateAuthNonce()).toBe("mobile-auth-nonce-uuid");
    expect(expoCryptoMocks.randomUUID).toHaveBeenCalledTimes(1);
    expect(expoCryptoMocks.getRandomBytes).not.toHaveBeenCalled();
  });

  it("falls back to secure random bytes when randomUUID throws", () => {
    expoCryptoMocks.randomUUID.mockImplementation(() => {
      throw new Error("randomUUID unavailable");
    });
    expoCryptoMocks.getRandomBytes.mockReturnValue(
      Uint8Array.from([0x00, 0x01, 0x0f, 0x10, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc])
    );

    expect(generateAuthNonce()).toBe("mobile-auth-00010f10aabbccddeeff123456789abc");
    expect(expoCryptoMocks.getRandomBytes).toHaveBeenCalledWith(16);
  });

  it("throws a stable error when secure random generation is unavailable", () => {
    expoCryptoMocks.randomUUID.mockImplementation(() => {
      throw new Error("randomUUID unavailable");
    });
    expoCryptoMocks.getRandomBytes.mockImplementation(() => {
      throw new Error("getRandomBytes unavailable");
    });

    expect(() => generateAuthNonce()).toThrow("Secure random generation is unavailable on this device.");
  });
});
