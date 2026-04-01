import { Platform } from "react-native";
import { z } from "zod";
import { extractApplePayWalletPayload, type ApplePayWalletPayload } from "./applePayPayload";

export type { ApplePayWalletPayload } from "./applePayPayload";

type PaymentRequestCtor = new (
  methodData: Array<Record<string, unknown>>,
  details: Record<string, unknown>,
  options?: Record<string, unknown>
) => {
  canMakePayment?: () => Promise<boolean>;
  show: () => Promise<unknown>;
};

const paymentResponseCompleteSchema = z.object({
  complete: z.function().args(z.string()).returns(z.void()).optional()
});

function resolvePaymentRequestCtor(): PaymentRequestCtor | undefined {
  const candidate = (globalThis as { PaymentRequest?: unknown }).PaymentRequest;
  if (!candidate || typeof candidate !== "function") {
    return undefined;
  }

  return candidate as PaymentRequestCtor;
}

export function canAttemptNativeApplePay() {
  return Platform.OS === "ios" && Boolean(resolvePaymentRequestCtor());
}

export async function requestNativeApplePayWallet(input: {
  amountCents: number;
  currencyCode?: string;
  countryCode?: string;
  label?: string;
  merchantIdentifier?: string;
}): Promise<ApplePayWalletPayload> {
  const PaymentRequest = resolvePaymentRequestCtor();
  if (Platform.OS !== "ios" || !PaymentRequest) {
    throw new Error("Native Apple Pay is unavailable in this build.");
  }

  if (!Number.isFinite(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Apple Pay amount must be a positive number.");
  }

  const currencyCode = (input.currencyCode ?? "USD").toUpperCase();
  const countryCode = (input.countryCode ?? "US").toUpperCase();
  const merchantIdentifier =
    input.merchantIdentifier ?? process.env.EXPO_PUBLIC_APPLE_PAY_MERCHANT_ID ?? "merchant.com.gazelle.dev";

  const paymentRequest = new PaymentRequest(
    [
      {
        supportedMethods: "apple-pay",
        data: {
          merchantIdentifier,
          supportedNetworks: ["visa", "masterCard", "amex", "discover"],
          countryCode,
          currencyCode,
          merchantCapabilities: ["supports3DS"]
        }
      }
    ],
    {
      total: {
        label: input.label ?? process.env.EXPO_PUBLIC_BRAND_NAME ?? "Gazelle Coffee",
        amount: (input.amountCents / 100).toFixed(2)
      }
    }
  );

  if (typeof paymentRequest.canMakePayment === "function") {
    const canMakePayment = await paymentRequest.canMakePayment();
    if (!canMakePayment) {
      throw new Error("Apple Pay is not available on this device/account.");
    }
  }

  const paymentResponse = await paymentRequest.show();
  const walletPayload = extractApplePayWalletPayload(paymentResponse);

  const completion = paymentResponseCompleteSchema.safeParse(paymentResponse);
  if (completion.success && completion.data.complete) {
    completion.data.complete(walletPayload ? "success" : "fail");
  }

  if (!walletPayload) {
    throw new Error("Unable to extract Apple Pay wallet payload from native response.");
  }

  return walletPayload;
}
