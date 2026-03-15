import type { LoyaltyLedgerEntry, OrderHistoryEntry } from "../account/data";

export function formatOrderDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString();
}

export function formatOrderStatus(status: string) {
  return status.replaceAll("_", " ");
}

export function findLatestOrderTime(order: OrderHistoryEntry) {
  return order.timeline[order.timeline.length - 1]?.occurredAt ?? "";
}

export function findRefundEntriesForOrder(orderId: string, loyaltyLedger: LoyaltyLedgerEntry[]) {
  return loyaltyLedger.filter((entry) => entry.type === "REFUND" && entry.orderId === orderId);
}

export function hasRefundActivity(order: OrderHistoryEntry, loyaltyLedger: LoyaltyLedgerEntry[]) {
  return order.status === "CANCELED" || findRefundEntriesForOrder(order.id, loyaltyLedger).length > 0;
}
