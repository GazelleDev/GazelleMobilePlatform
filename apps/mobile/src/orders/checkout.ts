import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import type { CartItem } from "../cart/model";

export type CheckoutInput = {
  locationId: string;
  items: CartItem[];
  applePayToken: string;
  pointsToRedeem?: number;
};

export function toQuoteItems(items: CartItem[]): Array<{ itemId: string; quantity: number }> {
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

export function useApplePayCheckoutMutation() {
  return useMutation({
    mutationFn: async (input: CheckoutInput) => {
      if (input.items.length === 0) {
        throw new Error("Cart is empty.");
      }

      const applePayToken = input.applePayToken.trim();
      if (!applePayToken) {
        throw new Error("Apple Pay token is required.");
      }

      const quote = await apiClient.quoteOrder({
        locationId: input.locationId,
        items: toQuoteItems(input.items),
        pointsToRedeem: input.pointsToRedeem ?? 0
      });

      const order = await apiClient.createOrder({
        quoteId: quote.quoteId,
        quoteHash: quote.quoteHash
      });

      return apiClient.payOrder(order.id, {
        applePayToken,
        idempotencyKey: createCheckoutIdempotencyKey()
      });
    }
  });
}
