import { z } from "zod";

export const applePayWalletPayloadSchema = z.object({
  version: z.string().min(1),
  data: z.string().min(1),
  signature: z.string().min(1),
  header: z.object({
    ephemeralPublicKey: z.string().min(1),
    publicKeyHash: z.string().min(1),
    transactionId: z.string().min(1),
    applicationData: z.string().min(1).optional()
  })
});
export type ApplePayWalletPayload = z.output<typeof applePayWalletPayloadSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function toCandidateWalletInputs(value: unknown): unknown[] {
  const parsed = parseJsonIfString(value);
  if (!isRecord(parsed)) {
    return [parsed];
  }

  return [
    parsed,
    parsed.token,
    parsed.paymentData,
    isRecord(parsed.token) ? parsed.token.paymentData : undefined,
    isRecord(parsed.paymentData) ? parsed.paymentData.token : undefined,
    isRecord(parsed.paymentData) ? parsed.paymentData.paymentData : undefined
  ];
}

export function extractApplePayWalletPayload(value: unknown): ApplePayWalletPayload | null {
  const candidates = toCandidateWalletInputs(value);
  for (const candidate of candidates) {
    const parsed = applePayWalletPayloadSchema.safeParse(candidate);
    if (parsed.success) {
      return parsed.data;
    }
  }

  return null;
}
