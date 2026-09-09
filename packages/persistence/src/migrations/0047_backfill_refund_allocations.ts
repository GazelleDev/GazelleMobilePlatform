import { sql, type Kysely } from "kysely";

type MigrationDb = Kysely<Record<string, never>>;

type QuoteItem = {
  itemId?: unknown;
  quantity?: unknown;
  unitPriceCents?: unknown;
  lineTotalCents?: unknown;
};

type RefundSnapshot = {
  refundId?: unknown;
  provider?: unknown;
  orderId?: unknown;
  paymentId?: unknown;
  status?: unknown;
  amountCents?: unknown;
  currency?: unknown;
  occurredAt?: unknown;
  message?: unknown;
  allocation?: unknown;
};

function integer(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}

function buildAllocation(quote: {
  items?: unknown;
  subtotal?: unknown;
  discount?: unknown;
}) {
  const items = Array.isArray(quote.items) ? quote.items as QuoteItem[] : [];
  const subtotal = typeof quote.subtotal === "object" && quote.subtotal !== null
    ? integer((quote.subtotal as { amountCents?: unknown }).amountCents)
    : undefined;
  const discount = typeof quote.discount === "object" && quote.discount !== null
    ? integer((quote.discount as { amountCents?: unknown }).amountCents)
    : undefined;
  if (subtotal === undefined || discount === undefined || items.length === 0) return undefined;

  const merchandiseAmountCents = Math.max(subtotal - discount, 0);
  const lineTotals = items.map((item) => {
    const lineTotal = integer(item.lineTotalCents);
    const unitPrice = integer(item.unitPriceCents);
    const quantity = integer(item.quantity);
    return lineTotal ?? (unitPrice !== undefined && quantity !== undefined ? unitPrice * quantity : undefined);
  });
  if (lineTotals.some((value) => value === undefined)) return undefined;

  const validLineTotals = lineTotals.map((value) => value ?? 0);
  const totalLines = validLineTotals.reduce((sum, value) => sum + value, 0);
  const allocations = validLineTotals.map((lineTotal, lineIndex) => {
    const exact = totalLines > 0 ? (merchandiseAmountCents * lineTotal) / totalLines : 0;
    const base = Math.floor(exact);
    return { lineIndex, base, remainder: exact - base };
  });
  let remainderCents = merchandiseAmountCents - allocations.reduce((sum, item) => sum + item.base, 0);
  for (const item of [...allocations].sort((left, right) => right.remainder - left.remainder || left.lineIndex - right.lineIndex)) {
    if (remainderCents <= 0) break;
    item.base += 1;
    remainderCents -= 1;
  }

  return {
    merchandiseAmountCents,
    items: items.map((item, lineIndex) => ({
      lineIndex,
      itemId: typeof item.itemId === "string" ? item.itemId : `line-${lineIndex + 1}`,
      quantity: integer(item.quantity) ?? 1,
      amountCents: allocations[lineIndex]?.base ?? 0
    }))
  };
}

/**
 * Repairs only provable full-order refunds. Partial refunds remain untouched
 * because their merchandise allocation cannot be inferred from an aggregate
 * provider amount without risking incorrect financial reporting.
 */
export async function up(db: MigrationDb): Promise<void> {
  const result = await sql<{
    order_id: string;
    successful_refund_json: RefundSnapshot;
    quote_json: { items?: unknown; subtotal?: unknown; discount?: unknown };
  }>`
    SELECT o.order_id, o.successful_refund_json, q.quote_json
    FROM orders o
    JOIN orders_quotes q ON q.quote_id = o.quote_id
    WHERE o.successful_refund_json ->> 'status' = 'REFUNDED'
      AND (o.successful_refund_json -> 'allocation') IS NULL
      AND (o.successful_refund_json ->> 'amountCents')::integer = (q.quote_json -> 'total' ->> 'amountCents')::integer
  `.execute(db);

  for (const row of result.rows) {
    const allocation = buildAllocation(row.quote_json);
    if (!allocation) continue;
    const snapshot = { ...row.successful_refund_json, allocation };
    await sql`
      UPDATE orders
      SET successful_refund_json = ${JSON.stringify(snapshot)}::jsonb,
          updated_at = NOW()
      WHERE order_id = ${row.order_id}
        AND successful_refund_json ->> 'status' = 'REFUNDED'
        AND (successful_refund_json -> 'allocation') IS NULL
    `.execute(db);
  }
}

// Backfill data is intentionally not removed on rollback.
export async function down(db: MigrationDb): Promise<void> {
  void db;
}
