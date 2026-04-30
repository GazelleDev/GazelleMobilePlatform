import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { CartItem } from "../cart/model";
import { orderItemSchema, quoteRequestItemSchema } from "@lattelink/contracts-orders";
import { z } from "zod";

const orderStatusSchema = z.enum(["PENDING_PAYMENT", "PAID", "IN_PREP", "READY", "COMPLETED", "CANCELED"]);
const checkoutOrderSchema = z.object({
  id: z.string().uuid(),
  pickupCode: z.string().min(1),
  status: orderStatusSchema,
  items: z.array(orderItemSchema),
  total: z.object({
    currency: z.literal("USD"),
    amountCents: z.number().int().nonnegative()
  })
});

export type QuoteItem = z.input<typeof quoteRequestItemSchema>;
export type CheckoutOrderSnapshot = z.output<typeof checkoutOrderSchema> & {
  quoteItems: QuoteItem[];
};
export type CheckoutSubmissionStage = "quote" | "create" | "pay";
export type PreparedStripeCheckout = {
  order: CheckoutOrderSnapshot;
  paymentSession: Awaited<ReturnType<typeof apiClient.createStripeMobilePaymentSession>>;
};

export type CheckoutInput = {
  locationId: string;
  items: CartItem[];
  pointsToRedeem?: number;
  discountCode?: string;
  existingOrder?: CheckoutOrderSnapshot;
};

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

export function shouldShowCheckoutFailureScreen(error: CheckoutSubmissionError) {
  return error.stage !== "pay" || Boolean(error.order);
}

export function resolveInlineCheckoutErrorMessage(error: CheckoutSubmissionError) {
  if (error.stage === "pay" && !error.order) {
    return "Payment didn’t go through. Your bag is still ready, so you can try again.";
  }

  return error.message;
}

export function toQuoteItems(items: CartItem[]): QuoteItem[] {
  return items.map((item) => ({
    itemId: item.menuItemId,
    quantity: item.quantity,
    customization: item.customization
  }));
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

  return left.every((item, index) => {
    const other = right[index];
    if (!other) {
      return false;
    }

    return (
      item.itemId === other.itemId &&
      item.quantity === other.quantity &&
      JSON.stringify(item.customization ?? { selectedOptions: [], notes: "" }) ===
        JSON.stringify(other.customization ?? { selectedOptions: [], notes: "" })
    );
  });
}

type ParsedCheckoutApiError = {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
};

function parseCheckoutApiError(error: unknown): ParsedCheckoutApiError | undefined {
  if (!(error instanceof Error) || !error.message) {
    return undefined;
  }

  const jsonSuffixMatch = error.message.match(/:\s*(\{[\s\S]*\})$/);
  if (!jsonSuffixMatch) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonSuffixMatch[1]) as ParsedCheckoutApiError;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function resolveCheckoutErrorMessage(error: unknown, fallback: string) {
  const parsedApiError = parseCheckoutApiError(error);
  if (typeof parsedApiError?.message === "string" && parsedApiError.message.trim().length > 0) {
    return parsedApiError.message;
  }

  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  return error.message;
}

function toCheckoutOrderSnapshot(
  order: Awaited<ReturnType<typeof apiClient.createOrder>> | CheckoutOrderSnapshot,
  quoteItems: QuoteItem[]
): CheckoutOrderSnapshot {
  return {
    ...checkoutOrderSchema.parse(order),
    quoteItems
  };
}

type StripeCheckoutApi = Pick<typeof apiClient, "quoteOrder" | "createOrder" | "createStripeMobilePaymentSession">;

export async function prepareStripeCheckout(
  input: CheckoutInput,
  checkoutApi: StripeCheckoutApi = apiClient
): Promise<PreparedStripeCheckout> {
  if (input.items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const quoteItems = toQuoteItems(input.items);

  if (input.existingOrder) {
    const existingOrder = toCheckoutOrderSnapshot(input.existingOrder, quoteItems);
    if (existingOrder.status !== "PENDING_PAYMENT") {
      throw new CheckoutSubmissionError("Only unpaid orders can be retried.", "pay");
    }

    try {
      const paymentSession = await checkoutApi.createStripeMobilePaymentSession({
        orderId: existingOrder.id
      });

      return {
        order: existingOrder,
        paymentSession
      };
    } catch (error) {
      const message = resolveCheckoutErrorMessage(error, "Unable to prepare payment.");
      throw new CheckoutSubmissionError(message, "pay", existingOrder);
    }
  }

  let quote: Awaited<ReturnType<typeof apiClient.quoteOrder>>;
  try {
    const discountCode = input.discountCode?.trim();
    quote = await checkoutApi.quoteOrder({
      locationId: input.locationId,
      items: quoteItems,
      pointsToRedeem: input.pointsToRedeem ?? 0,
      ...(discountCode ? { discountCode } : {})
    });
  } catch (error) {
    const message = resolveCheckoutErrorMessage(error, "Unable to prepare checkout.");
    throw new CheckoutSubmissionError(message, "quote");
  }

  let order: Awaited<ReturnType<typeof apiClient.createOrder>>;
  try {
    order = await checkoutApi.createOrder({
      quoteId: quote.quoteId,
      quoteHash: quote.quoteHash
    });
  } catch (error) {
    const message = resolveCheckoutErrorMessage(error, "Unable to create order.");
    throw new CheckoutSubmissionError(message, "create");
  }

  const orderSnapshot = toCheckoutOrderSnapshot(order, quoteItems);

  try {
    const paymentSession = await checkoutApi.createStripeMobilePaymentSession({
      orderId: orderSnapshot.id
    });

    return {
      order: orderSnapshot,
      paymentSession
    };
  } catch (error) {
    const message = resolveCheckoutErrorMessage(error, "Unable to prepare payment.");
    throw new CheckoutSubmissionError(message, "pay", orderSnapshot);
  }
}

export function useStripeCheckoutMutation() {
  return useMutation({
    mutationFn: async (input: CheckoutInput) => prepareStripeCheckout(input)
  });
}
