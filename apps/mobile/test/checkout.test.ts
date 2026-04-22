import { describe, expect, it, vi } from "vitest";
import { normalizeCustomizationGroups } from "@lattelink/contracts-catalog";
import { createCartItem, DEFAULT_CUSTOMIZATION } from "../src/cart/model";
import {
  CheckoutSubmissionError,
  createCheckoutIdempotencyKey,
  createDemoApplePayToken,
  prepareStripeCheckout,
  resolveInlineCheckoutErrorMessage,
  shouldShowCheckoutFailureScreen,
  toQuoteItems,
  type CheckoutOrderSnapshot
} from "../src/orders/checkout";

const espressoGroups = normalizeCustomizationGroups([
  {
    id: "size",
    label: "Size",
    selectionType: "single" as const,
    required: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    options: [
      { id: "regular", label: "Regular", priceDeltaCents: 0, default: true, sortOrder: 0, available: true },
      { id: "large", label: "Large", priceDeltaCents: 100, sortOrder: 1, available: true }
    ]
  },
  {
    id: "milk",
    label: "Milk",
    selectionType: "single" as const,
    required: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 1,
    options: [
      { id: "whole", label: "Whole milk", priceDeltaCents: 0, default: true, sortOrder: 0, available: true },
      { id: "oat", label: "Oat milk", priceDeltaCents: 75, sortOrder: 1, available: true }
    ]
  }
]);

describe("checkout helpers", () => {
  it("aggregates cart lines by menu item id for quote input", () => {
    const items = [
      createCartItem({
        menuItemId: "latte",
        itemName: "Latte",
        basePriceCents: 575,
        customizationGroups: espressoGroups,
        customization: {
          ...DEFAULT_CUSTOMIZATION,
          selectedOptions: [
            { groupId: "size", optionId: "regular" },
            { groupId: "milk", optionId: "whole" }
          ]
        },
        quantity: 1
      }),
      createCartItem({
        menuItemId: "latte",
        itemName: "Latte",
        basePriceCents: 575,
        customizationGroups: espressoGroups,
        customization: {
          ...DEFAULT_CUSTOMIZATION,
          selectedOptions: [
            { groupId: "size", optionId: "regular" },
            { groupId: "milk", optionId: "oat" }
          ]
        },
        quantity: 2
      }),
      createCartItem({
        menuItemId: "croissant",
        itemName: "Croissant",
        basePriceCents: 425,
        customizationGroups: [],
        customization: DEFAULT_CUSTOMIZATION,
        quantity: 3
      })
    ];

    expect(toQuoteItems(items)).toEqual([
      {
        itemId: "latte",
        quantity: 1,
        customization: {
          selectedOptions: [
            { groupId: "milk", optionId: "whole" },
            { groupId: "size", optionId: "regular" }
          ],
          notes: ""
        }
      },
      {
        itemId: "latte",
        quantity: 2,
        customization: {
          selectedOptions: [
            { groupId: "milk", optionId: "oat" },
            { groupId: "size", optionId: "regular" }
          ],
          notes: ""
        }
      },
      {
        itemId: "croissant",
        quantity: 3,
        customization: {
          selectedOptions: [],
          notes: ""
        }
      }
    ]);
  });

  it("creates prefixed idempotency keys", () => {
    const key = createCheckoutIdempotencyKey();
    expect(key.startsWith("mobile-checkout-")).toBe(true);
  });

  it("creates prefixed demo Apple Pay tokens", () => {
    const token = createDemoApplePayToken();
    expect(token.startsWith("apple-pay-token-")).toBe(true);
  });

  it("keeps definitive pay failures on the cart", () => {
    const error = new CheckoutSubmissionError("Clover declined the charge", "pay");

    expect(shouldShowCheckoutFailureScreen(error)).toBe(false);
    expect(resolveInlineCheckoutErrorMessage(error)).toBe(
      "Payment didn’t go through. Your bag is still ready, so you can try again."
    );
  });

  it("keeps retryable pay failures on the failure screen", () => {
    const retryOrder: CheckoutOrderSnapshot = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      pickupCode: "ABC123",
      status: "PENDING_PAYMENT",
      items: [],
      total: {
        currency: "USD",
        amountCents: 575
      },
      quoteItems: []
    };
    const error = new CheckoutSubmissionError("Payment timed out", "pay", retryOrder);

    expect(shouldShowCheckoutFailureScreen(error)).toBe(true);
    expect(resolveInlineCheckoutErrorMessage(error)).toBe("Payment timed out");
  });

  it("prepares a Stripe payment session after quoting and creating an order", async () => {
    const items = [
      createCartItem({
        menuItemId: "latte",
        itemName: "Latte",
        basePriceCents: 575,
        customizationGroups: espressoGroups,
        customization: {
          ...DEFAULT_CUSTOMIZATION,
          selectedOptions: [
            { groupId: "size", optionId: "regular" },
            { groupId: "milk", optionId: "whole" }
          ]
        },
        quantity: 1
      })
    ];

    const checkoutApi = {
      quoteOrder: vi.fn().mockResolvedValue({
        quoteId: "5ec083a1-0f31-4d04-a525-7808a0d7624b",
        locationId: "flagship-01",
        items: [],
        subtotal: { currency: "USD", amountCents: 575 },
        discount: { currency: "USD", amountCents: 0 },
        tax: { currency: "USD", amountCents: 35 },
        total: { currency: "USD", amountCents: 610 },
        pointsToRedeem: 0,
        quoteHash: "quote-hash-123"
      }),
      createOrder: vi.fn().mockResolvedValue({
        id: "123e4567-e89b-12d3-a456-426614174000",
        locationId: "flagship-01",
        status: "PENDING_PAYMENT",
        pickupCode: "ABC123",
        items: [
          {
            itemId: "latte",
            itemName: "Latte",
            quantity: 1,
            unitPriceCents: 575,
            lineTotalCents: 575,
            customization: {
              notes: "",
              selectedOptions: [
                {
                  groupId: "milk",
                  groupLabel: "Milk",
                  optionId: "whole",
                  optionLabel: "Whole milk",
                  priceDeltaCents: 0
                }
              ]
            }
          }
        ],
        total: { currency: "USD", amountCents: 610 },
        timeline: []
      }),
      createStripeMobilePaymentSession: vi.fn().mockResolvedValue({
        orderId: "123e4567-e89b-12d3-a456-426614174000",
        paymentIntentId: "pi_123",
        paymentIntentClientSecret: "pi_123_secret_456",
        publishableKey: "pk_test_123",
        stripeAccountId: "acct_123",
        merchantDisplayName: "Gazelle Coffee",
        merchantCountryCode: "US",
        amountCents: 610,
        currency: "USD",
        applePayEnabled: true,
        cardEnabled: true
      })
    };

    const preparedCheckout = await prepareStripeCheckout(
      {
        locationId: "flagship-01",
        items
      },
      checkoutApi
    );

    expect(checkoutApi.quoteOrder).toHaveBeenCalledTimes(1);
    expect(checkoutApi.createOrder).toHaveBeenCalledTimes(1);
    expect(checkoutApi.createStripeMobilePaymentSession).toHaveBeenCalledWith({
      orderId: "123e4567-e89b-12d3-a456-426614174000"
    });
    expect(preparedCheckout.order.pickupCode).toBe("ABC123");
    expect(preparedCheckout.paymentSession.stripeAccountId).toBe("acct_123");
  });

  it("reuses an existing pending order when retrying Stripe checkout", async () => {
    const items = [
      createCartItem({
        menuItemId: "latte",
        itemName: "Latte",
        basePriceCents: 575,
        customizationGroups: espressoGroups,
        customization: {
          ...DEFAULT_CUSTOMIZATION,
          selectedOptions: [
            { groupId: "size", optionId: "regular" },
            { groupId: "milk", optionId: "whole" }
          ]
        },
        quantity: 1
      })
    ];
    const existingOrder: CheckoutOrderSnapshot = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      pickupCode: "ABC123",
      status: "PENDING_PAYMENT",
      items: [],
      total: {
        currency: "USD",
        amountCents: 575
      },
      quoteItems: []
    };
    const checkoutApi = {
      quoteOrder: vi.fn(),
      createOrder: vi.fn(),
      createStripeMobilePaymentSession: vi.fn().mockResolvedValue({
        orderId: existingOrder.id,
        paymentIntentId: "pi_retry_123",
        paymentIntentClientSecret: "pi_retry_123_secret_456",
        publishableKey: "pk_test_123",
        stripeAccountId: "acct_123",
        merchantDisplayName: "Gazelle Coffee",
        merchantCountryCode: "US",
        amountCents: 575,
        currency: "USD",
        applePayEnabled: true,
        cardEnabled: true
      })
    };

    const preparedCheckout = await prepareStripeCheckout(
      {
        locationId: "flagship-01",
        items,
        existingOrder: {
          ...existingOrder,
          quoteItems: toQuoteItems(items)
        }
      },
      checkoutApi
    );

    expect(checkoutApi.quoteOrder).not.toHaveBeenCalled();
    expect(checkoutApi.createOrder).not.toHaveBeenCalled();
    expect(checkoutApi.createStripeMobilePaymentSession).toHaveBeenCalledWith({
      orderId: existingOrder.id
    });
    expect(preparedCheckout.order.id).toBe(existingOrder.id);
  });
});
