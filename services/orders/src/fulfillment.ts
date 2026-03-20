import { orderSchema, orderStatusSchema, orderTimelineEntrySchema } from "@gazelle/contracts-orders";
import { z } from "zod";

type Order = z.output<typeof orderSchema>;
type OrderStatus = z.output<typeof orderStatusSchema>;

const temporaryFulfillmentFlow = ["PAID", "IN_PREP", "READY", "COMPLETED"] as const satisfies readonly OrderStatus[];

const temporaryFulfillmentThresholdsMs = {
  PAID: 0,
  IN_PREP: 5 * 60_000,
  READY: 10 * 60_000,
  COMPLETED: 15 * 60_000
} as const satisfies Record<(typeof temporaryFulfillmentFlow)[number], number>;

const temporaryFulfillmentNotes = {
  IN_PREP: "Order moved into preparation.",
  READY: "Order is ready for pickup.",
  COMPLETED: "Order completed."
} as const satisfies Record<Exclude<(typeof temporaryFulfillmentFlow)[number], "PAID">, string>;

export type TemporaryFulfillmentStatus = (typeof temporaryFulfillmentFlow)[number];

export type ReconcileOrderFulfillmentStateResult = {
  order: Order;
  changed: boolean;
  appendedStatuses: Array<Exclude<TemporaryFulfillmentStatus, "PAID">>;
};

function hasTimelineStatus(order: Order, status: TemporaryFulfillmentStatus) {
  return order.timeline.some((entry) => entry.status === status);
}

function getPaidTimelineEntry(order: Order) {
  return order.timeline.find((entry) => entry.status === "PAID");
}

function getTemporaryFulfillmentIndex(status: OrderStatus) {
  return temporaryFulfillmentFlow.findIndex((candidate) => candidate === status);
}

export function getTemporaryFulfillmentTargetStatus(
  paidOccurredAt: Date,
  now: Date
): TemporaryFulfillmentStatus {
  const elapsedMs = now.getTime() - paidOccurredAt.getTime();

  if (!Number.isFinite(elapsedMs) || elapsedMs < temporaryFulfillmentThresholdsMs.IN_PREP) {
    return "PAID";
  }

  if (elapsedMs < temporaryFulfillmentThresholdsMs.READY) {
    return "IN_PREP";
  }

  if (elapsedMs < temporaryFulfillmentThresholdsMs.COMPLETED) {
    return "READY";
  }

  return "COMPLETED";
}

export function reconcileOrderFulfillmentState(
  order: Order,
  now: Date = new Date()
): ReconcileOrderFulfillmentStateResult {
  // TODO(platform): Replace this temporary time-based fulfillment progression with authoritative order state transitions driven by staff actions, POS/webhook events, or kitchen workflow. This stopgap exists only to unblock the mobile active-order experience until real fulfillment writers are implemented.
  if (order.status === "PENDING_PAYMENT" || order.status === "CANCELED" || order.status === "COMPLETED") {
    return {
      order,
      changed: false,
      appendedStatuses: []
    };
  }

  const currentIndex = getTemporaryFulfillmentIndex(order.status);
  if (currentIndex === -1) {
    return {
      order,
      changed: false,
      appendedStatuses: []
    };
  }

  const paidTimelineEntry = getPaidTimelineEntry(order);
  if (!paidTimelineEntry) {
    return {
      order,
      changed: false,
      appendedStatuses: []
    };
  }

  const paidOccurredAtMs = Date.parse(paidTimelineEntry.occurredAt);
  if (!Number.isFinite(paidOccurredAtMs)) {
    return {
      order,
      changed: false,
      appendedStatuses: []
    };
  }

  const targetStatus = getTemporaryFulfillmentTargetStatus(new Date(paidOccurredAtMs), now);
  const targetIndex = getTemporaryFulfillmentIndex(targetStatus);
  if (targetIndex <= currentIndex) {
    return {
      order,
      changed: false,
      appendedStatuses: []
    };
  }

  let nextOrder = order;
  const appendedStatuses: Array<Exclude<TemporaryFulfillmentStatus, "PAID">> = [];

  for (let index = currentIndex + 1; index <= targetIndex; index += 1) {
    const status = temporaryFulfillmentFlow[index];
    const nextStatus = status as Exclude<TemporaryFulfillmentStatus, "PAID">;
    const occurredAt = new Date(paidOccurredAtMs + temporaryFulfillmentThresholdsMs[status]).toISOString();

    nextOrder = orderSchema.parse({
      ...nextOrder,
      status
    });

    if (hasTimelineStatus(nextOrder, status)) {
      continue;
    }

    const nextTimelineEntry = orderTimelineEntrySchema.parse({
      status,
      occurredAt,
      note: temporaryFulfillmentNotes[nextStatus]
    });
    nextOrder = orderSchema.parse({
      ...nextOrder,
      timeline: [...nextOrder.timeline, nextTimelineEntry]
    });
    appendedStatuses.push(nextStatus);
  }

  return {
    order: nextOrder,
    changed: true,
    appendedStatuses
  };
}
