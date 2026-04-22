import { z } from "zod";

export const paymentWebhookKindSchema = z.enum(["CHARGE", "REFUND"]);
export const paymentWebhookStatusSchema = z.enum([
  "SUCCEEDED",
  "DECLINED",
  "TIMEOUT",
  "REFUNDED",
  "REJECTED"
]);

export const paymentWebhookDispatchResultSchema = z.object({
  accepted: z.literal(true),
  kind: paymentWebhookKindSchema,
  orderId: z.string().uuid(),
  paymentId: z.string().min(1),
  status: paymentWebhookStatusSchema,
  orderApplied: z.boolean()
});

export type PaymentWebhookDispatchResult = z.output<typeof paymentWebhookDispatchResultSchema>;
