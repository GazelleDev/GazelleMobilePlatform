import { z } from "zod";

/**
 * Local wall-clock boundary, interpreted in the resolved reporting IANA timezone.
 * `end` is exclusive. Offsets are intentionally disallowed so a browser timezone
 * can never silently define a store reporting period.
 */
export const reportingBoundarySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/, "Use a local ISO date or datetime without an offset.");

export const reportingTimezoneSchema = z.string().trim().min(1).max(100);
export const reportingGranularitySchema = z.enum(["hour", "day"]);

export const reportingQueryRequestSchema = z.object({
  locationIds: z.array(z.string().trim().min(1)).min(1).max(100).optional(),
  start: reportingBoundarySchema,
  end: reportingBoundarySchema,
  granularity: reportingGranularitySchema.default("day")
}).strict();

export const reportingScopedQuerySchema = reportingQueryRequestSchema.extend({
  locationIds: z.array(z.string().trim().min(1)).min(1).max(100)
});

// Existing Nomly money is integer cents. Reporting additionally permits signed
// balances because a refund-only period can legitimately have negative net sales.
export const reportingMoneySchema = z.object({ currency: z.literal("USD"), amountCents: z.number().int() });
const nullableMoneySchema = reportingMoneySchema.nullable();

export const reportingMetricsSchema = z.object({
  grossSales: nullableMoneySchema,
  discounts: nullableMoneySchema,
  netSales: nullableMoneySchema,
  tax: nullableMoneySchema,
  collected: nullableMoneySchema,
  refunds: nullableMoneySchema,
  netCollected: nullableMoneySchema,
  paidOrders: z.number().int().nonnegative(),
  averageOrderValue: nullableMoneySchema
});

export const reportingDataQualitySchema = z.object({
  missingQuotePaidOrders: z.number().int().nonnegative(),
  unallocatableRefunds: z.number().int().nonnegative(),
  /** True only when merchandise metrics and AOV are reconstructed without a fallback. */
  merchandiseMetricsComplete: z.boolean()
});

export const reportingMetricComparisonSchema = z.object({
  current: nullableMoneySchema,
  previous: nullableMoneySchema,
  /** null means the comparison is not mathematically defined (previous is zero or a value is unavailable). */
  percentChange: z.number().nullable()
});

export const reportingComparisonSchema = z.object({
  grossSales: reportingMetricComparisonSchema,
  discounts: reportingMetricComparisonSchema,
  netSales: reportingMetricComparisonSchema,
  tax: reportingMetricComparisonSchema,
  collected: reportingMetricComparisonSchema,
  refunds: reportingMetricComparisonSchema,
  netCollected: reportingMetricComparisonSchema,
  paidOrders: z.object({ current: z.number().int().nonnegative(), previous: z.number().int().nonnegative(), percentChange: z.number().nullable() }),
  averageOrderValue: reportingMetricComparisonSchema
});

export const reportingSeriesBucketSchema = reportingMetricsSchema.extend({
  start: z.string().datetime(),
  end: z.string().datetime(),
  dataQuality: reportingDataQualitySchema
});

export const reportingLocationBreakdownSchema = reportingMetricsSchema.extend({
  locationId: z.string().min(1),
  locationName: z.string().min(1),
  dataQuality: reportingDataQualitySchema
});

export const reportingResponseSchema = z.object({
  query: z.object({
    locationIds: z.array(z.string().min(1)).min(1),
    start: z.string().datetime(),
    end: z.string().datetime(),
    previousStart: z.string().datetime(),
    previousEnd: z.string().datetime(),
    timezone: reportingTimezoneSchema,
    granularity: reportingGranularitySchema
  }),
  summary: reportingMetricsSchema.extend({ dataQuality: reportingDataQualitySchema }),
  previous: reportingMetricsSchema.extend({ dataQuality: reportingDataQualitySchema }),
  comparison: reportingComparisonSchema,
  series: z.array(reportingSeriesBucketSchema),
  locations: z.array(reportingLocationBreakdownSchema)
});

export const reportingContract = {
  basePath: "/reporting",
  routes: { query: { method: "POST", path: "/query", request: reportingQueryRequestSchema, response: reportingResponseSchema } }
} as const;

export type ReportingQuery = z.output<typeof reportingScopedQuerySchema>;
export type ReportingResponse = z.output<typeof reportingResponseSchema>;
