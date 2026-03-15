import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { CartItem } from "../cart/model";
import { z } from "zod";

type PayOrderInput = Parameters<(typeof apiClient)["payOrder"]>[1];
type ApplePayWalletInput = NonNullable<PayOrderInput["applePayWallet"]>;
const orderStatusSchema = z.enum(["PENDING_PAYMENT", "PAID", "IN_PREP", "READY", "COMPLETED", "CANCELED"]);
const checkoutOrderSchema = z.object({
  id: z.string().uuid(),
  pickupCode: z.string().min(1),
  status: orderStatusSchema,
  total: z.object({
    currency: z.literal("USD"),
    amountCents: z.number().int().nonnegative()
  })
});

export type QuoteItem = { itemId: string; quantity: number };
export type CheckoutOrderSnapshot = z.output<typeof checkoutOrderSchema> & {
  quoteItems: QuoteItem[];
};
export type CheckoutSubmissionStage = "quote" | "create" | "pay";

type CheckoutPaymentInput =
  | { applePayToken: string; applePayWallet?: never }
  | { applePayWallet: ApplePayWalletInput; applePayToken?: never };

export type CheckoutInput = {
  locationId: string;
  items: CartItem[];
  pointsToRedeem?: number;
  existingOrder?: CheckoutOrderSnapshot;
} & CheckoutPaymentInput;

export class CheckoutSubmissionError extends Error {
  readonly stage: CheckoutSubmissionStage;
  readonly order?: CheckoutOrderSnapshot;

  constructor(message: string, stage: CheckoutSubmissionStage, order?: CheckoutOrderSnapshot) {
    super(message);
    this.name = "CheckoutSubmissionError";
    this.stage = stage;
    this.order = order;
  }
}

export function toQuoteItems(items: CartItem[]): QuoteItem[] {
  const quantityByItemId = new Map<string, number>();

  for (const item of items) {
    const currentQuantity = quantityByItemId.get(item.menuItemId) ?? 0;
    quantityByItemId.set(item.menuItemId, currentQuantity + item.quantity);
  }

  return [...quantityByItemId.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

export function createCheckoutIdempotencyKey() {
  return `mobile-checkout-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createDemoApplePayToken() {
  return `apple-pay-token-${Date.now()}`;
}

export function quoteItemsEqual(left: QuoteItem[], right: QuoteItem[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => item.itemId === right[index]?.itemId && item.quantity === right[index]?.quantity);
}

export function useApplePayCheckoutMutation() {
  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      if (input.items.length === 0) {
        throw new Error("Cart is empty.");
      }

      const hasToken = typeof (input as { applePayToken?: string }).applePayToken === "string";
      const hasWallet = typeof (input as { applePayWallet?: ApplePayWalletInput }).applePayWallet !== "undefined";

      if (hasToken === hasWallet) {
        throw new Error("Provide exactly one Apple Pay payment payload.");
      }

      const paymentPayload: Pick<PayOrderInput, "applePayToken" | "applePayWallet"> = hasToken
        ? (() => {
            const applePayToken = (input as { applePayToken: string }).applePayToken.trim();
            if (!applePayToken) {
              throw new Error("Apple Pay token is required.");
            }

            return { applePayToken };
          })()
        : { applePayWallet: (input as { applePayWallet: ApplePayWalletInput }).applePayWallet };

      if (input.existingOrder) {
        try {
          return await apiClient.payOrder(input.existingOrder.id, {
            ...paymentPayload,
            idempotencyKey: createCheckoutIdempotencyKey()
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unable to complete payment.";
          throw new CheckoutSubmissionError(message, "pay", input.existingOrder);
        }
      }

      const quoteItems = toQuoteItems(input.items);
      let quote: Awaited<ReturnType<typeof apiClient.quoteOrder>>;
      try {
        quote = await apiClient.quoteOrder({
          locationId: input.locationId,
          items: quoteItems,
          pointsToRedeem: input.pointsToRedeem ?? 0
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to prepare checkout.";
        throw new CheckoutSubmissionError(message, "quote");
      }

      let order: Awaited<ReturnType<typeof apiClient.createOrder>>;
      try {
        order = await apiClient.createOrder({
          quoteId: quote.quoteId,
          quoteHash: quote.quoteHash
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to create order.";
        throw new CheckoutSubmissionError(message, "create");
      }

      const orderSnapshot: CheckoutOrderSnapshot = {
        ...checkoutOrderSchema.parse(order),
        quoteItems
      };

      try {
        return await apiClient.payOrder(order.id, {
          ...paymentPayload,
          idempotencyKey: createCheckoutIdempotencyKey()
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to complete payment.";
        throw new CheckoutSubmissionError(message, "pay", orderSnapshot);
      }
    }
  });
}
