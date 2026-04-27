import { z } from "zod";
import { moneySchema } from "@lattelink/contracts-core";
import { menuItemCustomizationInputSchema } from "@lattelink/contracts-catalog";

export const orderStatusSchema = z.enum([
  "PENDING_PAYMENT",
  "PAID",
  "IN_PREP",
  "READY",
  "COMPLETED",
  "CANCELED"
]);

export const orderItemCustomizationSelectionSnapshotSchema = z.object({
  groupId: z.string(),
  groupLabel: z.string(),
  optionId: z.string(),
  optionLabel: z.string(),
  priceDeltaCents: z.number().int()
});

export const orderItemCustomizationSnapshotSchema = z.object({
  notes: z.string().default(""),
  selectedOptions: z.array(orderItemCustomizationSelectionSnapshotSchema).default([])
});

export const orderItemSchema = z.object({
  itemId: z.string(),
  itemName: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  lineTotalCents: z.number().int().nonnegative().optional(),
  customization: orderItemCustomizationSnapshotSchema.optional()
});

export const orderQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  locationId: z.string(),
  items: z.array(orderItemSchema),
  subtotal: moneySchema,
  discount: moneySchema,
  tax: moneySchema,
  total: moneySchema,
  pointsToRedeem: z.number().int().nonnegative(),
  quoteHash: z.string().min(1)
});

export const orderTimelineEntrySchema = z.object({
  status: orderStatusSchema,
  occurredAt: z.string().datetime(),
  note: z.string().optional(),
  source: z.enum(["system", "staff", "webhook", "customer"]).optional()
});

export const orderCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional()
});

export const orderSchema = z.object({
  id: z.string().uuid(),
  locationId: z.string(),
  status: orderStatusSchema,
  items: z.array(orderItemSchema),
  total: moneySchema,
  pickupCode: z.string(),
  timeline: z.array(orderTimelineEntrySchema),
  customer: orderCustomerSchema.optional()
});

export const quoteRequestItemSchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().positive(),
  customization: menuItemCustomizationInputSchema.default({
    selectedOptions: [],
    notes: ""
  })
});

export const quoteRequestSchema = z.object({
  locationId: z.string(),
  items: z.array(quoteRequestItemSchema),
  pointsToRedeem: z.number().int().nonnegative().default(0)
});

export const createOrderRequestSchema = z.object({
  quoteId: z.string().uuid(),
  quoteHash: z.string().min(1)
});

export const stripeMobilePaymentSessionRequestSchema = z.object({
  orderId: z.string().uuid()
});

export const stripeMobilePaymentFinalizeRequestSchema = z.object({
  orderId: z.string().uuid(),
  paymentIntentId: z.string().min(1)
});

export const stripeMobilePaymentSessionResponseSchema = z.object({
  orderId: z.string().uuid(),
  paymentIntentId: z.string().min(1),
  paymentIntentClientSecret: z.string().min(1),
  publishableKey: z.string().min(1),
  stripeAccountId: z.string().min(1),
  merchantDisplayName: z.string().min(1),
  merchantCountryCode: z.literal("US"),
  amountCents: z.number().int().positive(),
  currency: z.literal("USD"),
  applePayEnabled: z.boolean(),
  cardEnabled: z.boolean()
});

export const stripeMobilePaymentFinalizeResponseSchema = z.object({
  orderId: z.string().uuid(),
  paymentIntentId: z.string().min(1),
  accepted: z.literal(true),
  applied: z.boolean(),
  orderStatus: orderStatusSchema,
  note: z.string().optional()
});

export const orderPaymentContextSchema = z.object({
  orderId: z.string().uuid(),
  locationId: z.string().min(1),
  status: orderStatusSchema,
  total: moneySchema
});

export type OrderStatus = z.output<typeof orderStatusSchema>;
export type OrderCustomer = z.output<typeof orderCustomerSchema>;
export type OrderItemCustomizationSelectionSnapshot = z.output<typeof orderItemCustomizationSelectionSnapshotSchema>;
export type OrderItemCustomizationSnapshot = z.output<typeof orderItemCustomizationSnapshotSchema>;
export type OrderItem = z.output<typeof orderItemSchema>;
export type OrderQuote = z.output<typeof orderQuoteSchema>;
export type OrderTimelineEntry = z.output<typeof orderTimelineEntrySchema>;
export type Order = z.output<typeof orderSchema>;
export type StripeMobilePaymentSessionRequest = z.output<typeof stripeMobilePaymentSessionRequestSchema>;
export type StripeMobilePaymentSessionResponse = z.output<typeof stripeMobilePaymentSessionResponseSchema>;
export type StripeMobilePaymentFinalizeRequest = z.output<typeof stripeMobilePaymentFinalizeRequestSchema>;
export type StripeMobilePaymentFinalizeResponse = z.output<typeof stripeMobilePaymentFinalizeResponseSchema>;
export type OrderPaymentContext = z.output<typeof orderPaymentContextSchema>;

export const paymentReconciliationProviderSchema = z.enum(["CLOVER", "STRIPE"]);

export const paymentChargeReconciliationSchema = z.object({
  eventId: z.string().min(1).optional(),
  provider: paymentReconciliationProviderSchema,
  kind: z.literal("CHARGE"),
  orderId: z.string().uuid(),
  paymentId: z.string().min(1),
  status: z.enum(["SUCCEEDED", "DECLINED", "TIMEOUT"]),
  occurredAt: z.string().datetime(),
  message: z.string().optional(),
  declineCode: z.string().optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.literal("USD").optional()
});

export const paymentRefundReconciliationSchema = z.object({
  eventId: z.string().min(1).optional(),
  provider: paymentReconciliationProviderSchema,
  kind: z.literal("REFUND"),
  orderId: z.string().uuid(),
  paymentId: z.string().min(1),
  refundId: z.string().min(1).optional(),
  status: z.enum(["REFUNDED", "REJECTED"]),
  occurredAt: z.string().datetime(),
  message: z.string().optional(),
  amountCents: z.number().int().positive().optional(),
  currency: z.literal("USD").optional()
});

export const ordersPaymentReconciliationSchema = z.union([
  paymentChargeReconciliationSchema,
  paymentRefundReconciliationSchema
]);

export const ordersPaymentReconciliationResultSchema = z.object({
  accepted: z.literal(true),
  applied: z.boolean(),
  orderStatus: orderStatusSchema.optional(),
  note: z.string().optional()
});

export const ordersContract = {
  basePath: "/orders",
  routes: {
    quote: {
      method: "POST",
      path: "/quote",
      request: quoteRequestSchema,
      response: orderQuoteSchema
    },
    create: {
      method: "POST",
      path: "/",
      request: createOrderRequestSchema,
      response: orderSchema
    },
    list: {
      method: "GET",
      path: "/",
      request: z.undefined(),
      response: z.array(orderSchema)
    },
    get: {
      method: "GET",
      path: "/:orderId",
      request: z.undefined(),
      response: orderSchema
    },
    cancel: {
      method: "POST",
      path: "/:orderId/cancel",
      request: z.object({ reason: z.string().min(1) }),
      response: orderSchema
    }
  }
} as const;
