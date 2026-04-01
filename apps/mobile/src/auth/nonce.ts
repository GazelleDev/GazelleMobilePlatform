import * as Crypto from "expo-crypto";

export function generateAuthNonce(): string {
  try {
    return `mobile-auth-${Crypto.randomUUID()}`;
  } catch {
    try {
      const bytes = Crypto.getRandomBytes(16);
      return `mobile-auth-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    } catch {
      throw new Error("Secure random generation is unavailable on this device.");
    }
  }
}
