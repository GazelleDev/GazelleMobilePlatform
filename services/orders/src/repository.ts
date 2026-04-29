import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { normalizeCustomizationGroups, type MenuItemCustomizationGroup } from "@lattelink/contracts-catalog";
import { orderCustomerSchema, orderQuoteSchema, orderSchema } from "@lattelink/contracts-orders";
import {
  allowsInMemoryPersistence,
  buildPersistenceStartupError,
  createPostgresDb,
  getDatabaseUrl,
  runMigrations,
  sql,
  writeAuditLog,
  type AuditLogEntry
} from "@lattelink/persistence";
import { z } from "zod";

type OrderQuote = z.output<typeof orderQuoteSchema>;
type Order = z.output<typeof orderSchema>;
type OrderCustomer = z.output<typeof orderCustomerSchema>;

type StoredOrderRecord = {
  order: Order;
  quoteId: string;
  userId: string;
  paymentId?: string;
  successfulCharge?: unknown;
  successfulRefund?: unknown;
};

type PersistedOrderRow = {
  order_id: string;
  user_id: string;
  quote_id: string;
  order_json: unknown;
  payment_id: string | null;
  successful_charge_json: unknown;
  successful_refund_json: unknown;
  created_at?: string | Date;
  updated_at?: string | Date;
};

type PersistedQuoteRow = {
  quote_id: string;
  quote_hash: string;
  quote_json: unknown;
};

export type SupportAuditLogEntry = {
  logId: string;
  locationId: string;
  actorId: string;
  actorType: string;
  action: string;
  targetId?: string;
  targetType?: string;
  payload?: unknown;
  occurredAt: string;
};

export type SupportOrderLookupResult = {
  order: Order;
  customer?: OrderCustomer;
  userId?: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentProvider?: string;
  paymentIntentId?: string;
  successfulCharge?: unknown;
  successfulRefund?: unknown;
  createdAt?: string;
  updatedAt?: string;
  auditLog: SupportAuditLogEntry[];
};

const defaultTaxRateBasisPoints = 600;

function trimToUndefined(value: string | null | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

function parseIsoDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}

export type QuoteCatalogItem = {
  itemId: string;
  itemName: string;
  basePriceCents: number;
  customizationGroups: MenuItemCustomizationGroup[];
};

export type OrdersRepository = {
  backend: "memory" | "postgres";
  saveQuote(quote: OrderQuote): Promise<void>;
  getQuote(quoteId: string): Promise<OrderQuote | undefined>;
  createOrder(input: { order: Order; quoteId: string; userId: string }): Promise<void>;
  getOrder(orderId: string): Promise<Order | undefined>;
  listOrders(): Promise<Order[]>;
  listOrdersByUser(userId: string): Promise<Order[]>;
  listOrdersByLocation(locationId: string): Promise<Order[]>;
  getOrderForCreateIdempotency(quoteId: string, quoteHash: string): Promise<Order | undefined>;
  saveCreateOrderIdempotency(quoteId: string, quoteHash: string, orderId: string): Promise<void>;
  getPaymentOrderByIdempotency(orderId: string, idempotencyKey: string): Promise<Order | undefined>;
  savePaymentIdempotency(orderId: string, idempotencyKey: string): Promise<void>;
  getOrderQuote(orderId: string): Promise<OrderQuote | undefined>;
  getOrderUserId(orderId: string): Promise<string | undefined>;
  getOrderCustomer(orderId: string): Promise<OrderCustomer | undefined>;
  listOrderCustomers(orderIds: readonly string[]): Promise<Map<string, OrderCustomer>>;
  setOrderUserId(orderId: string, userId: string): Promise<void>;
  setPaymentId(orderId: string, paymentId: string): Promise<void>;
  getPaymentId(orderId: string): Promise<string | undefined>;
  setSuccessfulCharge(orderId: string, payload: unknown): Promise<void>;
  getSuccessfulCharge(orderId: string): Promise<unknown | undefined>;
  setSuccessfulRefund(orderId: string, payload: unknown): Promise<void>;
  getSuccessfulRefund(orderId: string): Promise<unknown | undefined>;
  updateOrder(orderId: string, order: Order): Promise<Order>;
  writeAuditLog(entry: AuditLogEntry): Promise<void>;
  lookupSupportOrders(input: { query: string; locationId?: string; limit?: number }): Promise<SupportOrderLookupResult[]>;
  getCatalogItemsForQuote(locationId: string, itemIds: string[]): Promise<Map<string, QuoteCatalogItem>>;
  getTaxRateBasisPoints(locationId: string): Promise<number>;
  pingDb(): Promise<void>;
  close(): Promise<void>;
};

function sortOrdersDescendingByCreatedAt(orders: Order[]) {
  return [...orders].sort((left, right) => {
    const leftCreatedAt = Date.parse(left.timeline[0]?.occurredAt ?? "1970-01-01T00:00:00.000Z");
    const rightCreatedAt = Date.parse(right.timeline[0]?.occurredAt ?? "1970-01-01T00:00:00.000Z");
    return rightCreatedAt - leftCreatedAt;
  });
}

function toSupportAuditLogEntry(row: {
  log_id: string;
  location_id: string;
  actor_id: string;
  actor_type: string;
  action: string;
  target_id: string | null;
  target_type: string | null;
  payload: unknown;
  occurred_at: string | Date;
}): SupportAuditLogEntry {
  return {
    logId: row.log_id,
    locationId: row.location_id,
    actorId: row.actor_id,
    actorType: row.actor_type,
    action: row.action,
    targetId: trimToUndefined(row.target_id),
    targetType: trimToUndefined(row.target_type),
    payload: row.payload ?? undefined,
    occurredAt: parseIsoDate(row.occurred_at)
  };
}

const fallbackCatalogItems = new Map<string, QuoteCatalogItem>([
  [
    "latte",
    {
      itemId: "latte",
      itemName: "Honey Oat Latte",
      basePriceCents: 675,
      customizationGroups: normalizeCustomizationGroups([
        {
          id: "size",
          sourceGroupId: "core:size",
          label: "Size",
          selectionType: "single",
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
          sourceGroupId: "core:milk",
          label: "Milk",
          selectionType: "single",
          required: true,
          minSelections: 1,
          maxSelections: 1,
          sortOrder: 1,
          options: [
            { id: "whole", label: "Whole milk", priceDeltaCents: 0, default: true, sortOrder: 0, available: true },
            { id: "oat", label: "Oat milk", priceDeltaCents: 75, sortOrder: 1, available: true }
          ]
        },
        {
          id: "extras",
          label: "Extras",
          selectionType: "multiple",
          required: false,
          minSelections: 0,
          maxSelections: 2,
          sortOrder: 2,
          options: [{ id: "extra-shot", label: "Extra shot", priceDeltaCents: 125, sortOrder: 0, available: true }]
        }
      ])
    }
  ],
  [
    "matcha",
    {
      itemId: "matcha",
      itemName: "Ceremonial Matcha",
      basePriceCents: 725,
      customizationGroups: normalizeCustomizationGroups([
        {
          id: "size",
          sourceGroupId: "core:size",
          label: "Size",
          selectionType: "single",
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
          sourceGroupId: "core:milk",
          label: "Milk",
          selectionType: "single",
          required: true,
          minSelections: 1,
          maxSelections: 1,
          sortOrder: 1,
          options: [
            { id: "whole", label: "Whole milk", priceDeltaCents: 0, default: true, sortOrder: 0, available: true },
            { id: "oat", label: "Oat milk", priceDeltaCents: 75, sortOrder: 1, available: true }
          ]
        },
        {
          id: "sweetness",
          sourceGroupId: "core:sweetness",
          label: "Sweetness",
          selectionType: "single",
          required: true,
          minSelections: 1,
          maxSelections: 1,
          sortOrder: 2,
          options: [
            { id: "full", label: "Full sweet", priceDeltaCents: 0, default: true, sortOrder: 0, available: true },
            { id: "half", label: "Half sweet", priceDeltaCents: 0, sortOrder: 1, available: true },
            { id: "unsweetened", label: "Unsweetened", priceDeltaCents: 0, sortOrder: 2, available: true }
          ]
        }
      ])
    }
  ],
  [
    "croissant",
    {
      itemId: "croissant",
      itemName: "Butter Croissant",
      basePriceCents: 425,
      customizationGroups: []
    }
  ]
]);

function createInMemoryRepository(): OrdersRepository {
  const quotesById = new Map<string, OrderQuote>();
  const ordersById = new Map<string, StoredOrderRecord>();
  const createOrderIdempotency = new Map<string, string>();
  const paymentIdempotency = new Map<string, string>();
  const auditLog: SupportAuditLogEntry[] = [];

  return {
    backend: "memory",
    async saveQuote(quote) {
      quotesById.set(quote.quoteId, quote);
    },
    async getQuote(quoteId) {
      return quotesById.get(quoteId);
    },
    async createOrder({ order, quoteId, userId }) {
      ordersById.set(order.id, {
        order,
        quoteId,
        userId
      });
    },
    async getOrder(orderId) {
      return ordersById.get(orderId)?.order;
    },
    async listOrders() {
      const orders = [...ordersById.values()].map((entry) => entry.order);
      return sortOrdersDescendingByCreatedAt(orders);
    },
    async listOrdersByUser(userId) {
      const orders = [...ordersById.values()]
        .filter((entry) => entry.userId === userId)
        .map((entry) => entry.order);
      return sortOrdersDescendingByCreatedAt(orders);
    },
    async listOrdersByLocation(locationId) {
      const orders = [...ordersById.values()]
        .filter((entry) => entry.order.locationId === locationId)
        .map((entry) => entry.order);
      return sortOrdersDescendingByCreatedAt(orders);
    },
    async getOrderForCreateIdempotency(quoteId, quoteHash) {
      const orderId = createOrderIdempotency.get(`${quoteId}:${quoteHash}`);
      if (!orderId) {
        return undefined;
      }
      return ordersById.get(orderId)?.order;
    },
    async saveCreateOrderIdempotency(quoteId, quoteHash, orderId) {
      createOrderIdempotency.set(`${quoteId}:${quoteHash}`, orderId);
    },
    async getPaymentOrderByIdempotency(orderId, idempotencyKey) {
      const resolvedOrderId = paymentIdempotency.get(`${orderId}:${idempotencyKey}`);
      if (!resolvedOrderId) {
        return undefined;
      }
      return ordersById.get(resolvedOrderId)?.order;
    },
    async savePaymentIdempotency(orderId, idempotencyKey) {
      paymentIdempotency.set(`${orderId}:${idempotencyKey}`, orderId);
    },
    async getOrderQuote(orderId) {
      const record = ordersById.get(orderId);
      if (!record) {
        return undefined;
      }
      return quotesById.get(record.quoteId);
    },
    async getOrderUserId(orderId) {
      return ordersById.get(orderId)?.userId;
    },
    async getOrderCustomer() {
      return undefined;
    },
    async listOrderCustomers() {
      return new Map();
    },
    async setOrderUserId(orderId, userId) {
      const record = ordersById.get(orderId);
      if (!record) {
        return;
      }
      ordersById.set(orderId, {
        ...record,
        userId
      });
    },
    async setPaymentId(orderId, paymentId) {
      const record = ordersById.get(orderId);
      if (!record) {
        return;
      }
      ordersById.set(orderId, {
        ...record,
        paymentId
      });
    },
    async getPaymentId(orderId) {
      return ordersById.get(orderId)?.paymentId;
    },
    async setSuccessfulCharge(orderId, payload) {
      const record = ordersById.get(orderId);
      if (!record) {
        return;
      }
      ordersById.set(orderId, {
        ...record,
        successfulCharge: payload
      });
    },
    async getSuccessfulCharge(orderId) {
      return ordersById.get(orderId)?.successfulCharge;
    },
    async setSuccessfulRefund(orderId, payload) {
      const record = ordersById.get(orderId);
      if (!record) {
        return;
      }
      ordersById.set(orderId, {
        ...record,
        successfulRefund: payload
      });
    },
    async getSuccessfulRefund(orderId) {
      return ordersById.get(orderId)?.successfulRefund;
    },
    async updateOrder(orderId, order) {
      const record = ordersById.get(orderId);
      if (!record) {
        throw new Error("order not found while updating");
      }
      ordersById.set(orderId, {
        ...record,
        order
      });
      return order;
    },
    async writeAuditLog(entry) {
      auditLog.unshift({
        logId: randomUUID(),
        locationId: entry.locationId,
        actorId: entry.actorId,
        actorType: entry.actorType,
        action: entry.action,
        targetId: entry.targetId,
        targetType: entry.targetType,
        payload: entry.payload,
        occurredAt: entry.occurredAt ?? new Date().toISOString()
      });
    },
    async lookupSupportOrders(input) {
      const query = input.query.trim().toLowerCase();
      const matches = [...ordersById.values()]
        .filter((record) => {
          if (input.locationId && record.order.locationId !== input.locationId) {
            return false;
          }

          return (
            record.order.id.toLowerCase() === query ||
            record.order.customer?.email?.toLowerCase() === query ||
            record.order.customer?.phone?.toLowerCase() === query
          );
        })
        .slice(0, input.limit ?? 25);

      return matches.map((record) => ({
        order: record.order,
        customer: record.order.customer,
        userId: record.userId,
        paymentId: record.paymentId,
        successfulCharge: record.successfulCharge,
        successfulRefund: record.successfulRefund,
        auditLog: auditLog.filter((entry) => entry.targetType === "order" && entry.targetId === record.order.id)
      }));
    },
    async getCatalogItemsForQuote(_locationId, itemIds) {
      const items = new Map<string, QuoteCatalogItem>();
      for (const itemId of itemIds) {
        const item = fallbackCatalogItems.get(itemId);
        if (item) {
          items.set(itemId, item);
        }
      }
      return items;
    },
    async getTaxRateBasisPoints() {
      return defaultTaxRateBasisPoints;
    },
    async pingDb() {
      // no-op for in-memory
    },
    async close() {
      // no-op
    }
  };
}

async function createPostgresRepository(
  connectionString: string,
  logger: FastifyBaseLogger
): Promise<OrdersRepository> {
  const db = createPostgresDb(connectionString);
  await runMigrations(db);

  async function getPersistedOrder(orderId: string): Promise<PersistedOrderRow | undefined> {
    const row = await db.selectFrom("orders").selectAll().where("order_id", "=", orderId).executeTakeFirst();
    return row as PersistedOrderRow | undefined;
  }

  function parseOrder(payload: unknown): Order {
    return orderSchema.parse(payload);
  }

  function parseOrderCustomer(payload: unknown): OrderCustomer | undefined {
    if (!payload || typeof payload !== "object") {
      return undefined;
    }

    const parsed = orderCustomerSchema.safeParse(payload);
    return parsed.success ? parsed.data : undefined;
  }

  function toOrderCustomerFromIdentityUser(row: {
    name: string | null;
    display_name: string | null;
    email: string | null;
    phone_number: string | null;
  }): OrderCustomer | undefined {
    return parseOrderCustomer({
      name: trimToUndefined(row.display_name) ?? trimToUndefined(row.name),
      email: trimToUndefined(row.email),
      phone: trimToUndefined(row.phone_number)
    });
  }

  function parseQuote(payload: unknown): OrderQuote {
    return orderQuoteSchema.parse(payload);
  }

  function parseCustomizationGroups(payload: unknown) {
    return normalizeCustomizationGroups(typeof payload === "string" ? JSON.parse(payload) : payload);
  }

  async function getQuoteById(quoteId: string): Promise<OrderQuote | undefined> {
    const row = await db.selectFrom("orders_quotes").selectAll().where("quote_id", "=", quoteId).executeTakeFirst();
    if (!row) {
      return undefined;
    }
    return parseQuote((row as PersistedQuoteRow).quote_json);
  }

  async function getOrderById(orderId: string): Promise<Order | undefined> {
    const row = await getPersistedOrder(orderId);
    if (!row) {
      return undefined;
    }
    return parseOrder(row.order_json);
  }

  return {
    backend: "postgres",
    async saveQuote(quote) {
      try {
        await db
          .insertInto("orders_quotes")
          .values({
            quote_id: quote.quoteId,
            quote_hash: quote.quoteHash,
            quote_json: quote
          })
          .execute();
        return;
      } catch {
        await db
          .updateTable("orders_quotes")
          .set({
            quote_hash: quote.quoteHash,
            quote_json: quote
          })
          .where("quote_id", "=", quote.quoteId)
          .execute();
      }
    },
    async getQuote(quoteId) {
      return getQuoteById(quoteId);
    },
    async createOrder({ order, quoteId, userId }) {
      await db
        .insertInto("orders")
        .values({
          order_id: order.id,
          user_id: userId,
          quote_id: quoteId,
          order_json: order
        })
        .execute();
    },
    async getOrder(orderId) {
      return getOrderById(orderId);
    },
    async listOrders() {
      const rows = await db.selectFrom("orders").selectAll().orderBy("created_at", "desc").execute();
      return rows.map((row) => parseOrder((row as PersistedOrderRow).order_json));
    },
    async listOrdersByUser(userId) {
      const rows = await db
        .selectFrom("orders")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .execute();
      return rows.map((row) => parseOrder((row as PersistedOrderRow).order_json));
    },
    async listOrdersByLocation(locationId) {
      const rows = await db
        .selectFrom("orders")
        .selectAll()
        .where(sql`order_json->>'locationId'`, "=", locationId)
        .orderBy("created_at", "desc")
        .execute();
      return rows.map((row) => parseOrder((row as PersistedOrderRow).order_json));
    },
    async getOrderForCreateIdempotency(quoteId, quoteHash) {
      const row = await db
        .selectFrom("orders_create_idempotency")
        .selectAll()
        .where("quote_id", "=", quoteId)
        .where("quote_hash", "=", quoteHash)
        .executeTakeFirst();

      if (!row) {
        return undefined;
      }

      return getOrderById(row.order_id);
    },
    async saveCreateOrderIdempotency(quoteId, quoteHash, orderId) {
      try {
        await db
          .insertInto("orders_create_idempotency")
          .values({
            quote_id: quoteId,
            quote_hash: quoteHash,
            order_id: orderId
          })
          .execute();
      } catch {
        // ignore duplicate key races
      }
    },
    async getPaymentOrderByIdempotency(orderId, idempotencyKey) {
      const row = await db
        .selectFrom("orders_payment_idempotency")
        .selectAll()
        .where("order_id", "=", orderId)
        .where("idempotency_key", "=", idempotencyKey)
        .executeTakeFirst();

      if (!row) {
        return undefined;
      }

      return getOrderById(row.order_id);
    },
    async savePaymentIdempotency(orderId, idempotencyKey) {
      try {
        await db
          .insertInto("orders_payment_idempotency")
          .values({
            order_id: orderId,
            idempotency_key: idempotencyKey
          })
          .execute();
      } catch {
        // ignore duplicate key races
      }
    },
    async getOrderQuote(orderId) {
      const orderRow = await getPersistedOrder(orderId);
      if (!orderRow) {
        return undefined;
      }
      return getQuoteById(orderRow.quote_id);
    },
    async getOrderUserId(orderId) {
      const row = await getPersistedOrder(orderId);
      return row?.user_id;
    },
    async getOrderCustomer(orderId) {
      const row = await db
        .selectFrom("orders")
        .innerJoin("identity_users", "identity_users.user_id", "orders.user_id")
        .select([
          "identity_users.name",
          "identity_users.display_name",
          "identity_users.email",
          "identity_users.phone_number"
        ])
        .where("orders.order_id", "=", orderId)
        .executeTakeFirst();

      return row ? toOrderCustomerFromIdentityUser(row) : undefined;
    },
    async listOrderCustomers(orderIds) {
      if (orderIds.length === 0) {
        return new Map();
      }

      const rows = await db
        .selectFrom("orders")
        .innerJoin("identity_users", "identity_users.user_id", "orders.user_id")
        .select([
          "orders.order_id",
          "identity_users.name",
          "identity_users.display_name",
          "identity_users.email",
          "identity_users.phone_number"
        ])
        .where("orders.order_id", "in", [...orderIds])
        .execute();

      return new Map(
        rows
          .map((row) => {
            const customer = toOrderCustomerFromIdentityUser(row);
            return customer ? ([row.order_id, customer] as const) : null;
          })
          .filter((entry): entry is readonly [string, OrderCustomer] => entry !== null)
      );
    },
    async setOrderUserId(orderId, userId) {
      await db
        .updateTable("orders")
        .set({
          user_id: userId,
          updated_at: new Date().toISOString()
        })
        .where("order_id", "=", orderId)
        .execute();
    },
    async setPaymentId(orderId, paymentId) {
      await db
        .updateTable("orders")
        .set({
          payment_id: paymentId,
          updated_at: new Date().toISOString()
        })
        .where("order_id", "=", orderId)
        .execute();
    },
    async getPaymentId(orderId) {
      const row = await getPersistedOrder(orderId);
      return row?.payment_id ?? undefined;
    },
    async setSuccessfulCharge(orderId, payload) {
      await db
        .updateTable("orders")
        .set({
          successful_charge_json: payload,
          updated_at: new Date().toISOString()
        })
        .where("order_id", "=", orderId)
        .execute();
    },
    async getSuccessfulCharge(orderId) {
      const row = await getPersistedOrder(orderId);
      return row?.successful_charge_json === null ? undefined : row?.successful_charge_json;
    },
    async setSuccessfulRefund(orderId, payload) {
      await db
        .updateTable("orders")
        .set({
          successful_refund_json: payload,
          updated_at: new Date().toISOString()
        })
        .where("order_id", "=", orderId)
        .execute();
    },
    async getSuccessfulRefund(orderId) {
      const row = await getPersistedOrder(orderId);
      return row?.successful_refund_json === null ? undefined : row?.successful_refund_json;
    },
    async updateOrder(orderId, order) {
      const updated = await db
        .updateTable("orders")
        .set({
          order_json: order,
          updated_at: new Date().toISOString()
        })
        .where("order_id", "=", orderId)
        .executeTakeFirst();

      if (Number(updated.numUpdatedRows ?? 0) === 0) {
        throw new Error("order not found while updating");
      }

      return order;
    },
    async writeAuditLog(entry) {
      await writeAuditLog(db, entry);
    },
    async lookupSupportOrders(input) {
      const query = input.query.trim();
      if (!query) {
        return [];
      }

      const normalizedQuery = query.toLowerCase();
      const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);
      let rowsQuery = db
        .selectFrom("orders")
        .leftJoin("identity_users", "identity_users.user_id", "orders.user_id")
        .leftJoin("payments_stripe_payment_intents", (join) =>
          join.on(sql<string>`payments_stripe_payment_intents.order_id`, "=", sql<string>`orders.order_id::text`)
        )
        .select([
          "orders.order_id as order_id",
          "orders.user_id as user_id",
          "orders.order_json as order_json",
          "orders.payment_id as payment_id",
          "orders.successful_charge_json as successful_charge_json",
          "orders.successful_refund_json as successful_refund_json",
          "orders.created_at as created_at",
          "orders.updated_at as updated_at",
          "identity_users.name as customer_name",
          "identity_users.display_name as customer_display_name",
          "identity_users.email as customer_email",
          "identity_users.phone_number as customer_phone_number",
          "payments_stripe_payment_intents.payment_intent_id as payment_intent_id",
          "payments_stripe_payment_intents.status as stripe_payment_status"
        ])
        .where((eb) =>
          eb.or([
            eb(sql<string>`orders.order_id::text`, "=", query),
            eb("orders.payment_id", "=", query),
            eb("payments_stripe_payment_intents.payment_intent_id", "=", query),
            eb(sql`LOWER(identity_users.email)`, "=", normalizedQuery),
            eb(sql`LOWER(identity_users.phone_number)`, "=", normalizedQuery)
          ])
        )
        .orderBy("orders.created_at", "desc")
        .limit(limit);

      if (input.locationId) {
        rowsQuery = rowsQuery.where(sql`orders.order_json->>'locationId'`, "=", input.locationId);
      }

      const rows = await rowsQuery.execute();
      const orderIds = rows.map((row) => row.order_id);
      const auditRows =
        orderIds.length === 0
          ? []
          : await db
              .selectFrom("audit_log")
              .selectAll()
              .where("target_type", "=", "order")
              .where("target_id", "in", orderIds)
              .orderBy("occurred_at", "desc")
              .limit(250)
              .execute();
      const auditByOrderId = new Map<string, SupportAuditLogEntry[]>();
      for (const row of auditRows) {
        const auditEntry = toSupportAuditLogEntry(row);
        const entries = auditByOrderId.get(auditEntry.targetId ?? "") ?? [];
        entries.push(auditEntry);
        if (auditEntry.targetId) {
          auditByOrderId.set(auditEntry.targetId, entries);
        }
      }

      return rows.map((row) => {
        const order = orderSchema.parse(row.order_json);
        const customer = toOrderCustomerFromIdentityUser({
          name: row.customer_name,
          display_name: row.customer_display_name,
          email: row.customer_email,
          phone_number: row.customer_phone_number
        });

        return {
          order,
          customer: customer ?? order.customer,
          userId: row.user_id,
          paymentId: row.payment_id ?? undefined,
          paymentProvider: row.payment_intent_id ? "STRIPE" : row.payment_id ? "CLOVER" : undefined,
          paymentStatus: row.stripe_payment_status ?? undefined,
          paymentIntentId: row.payment_intent_id ?? undefined,
          successfulCharge: row.successful_charge_json ?? undefined,
          successfulRefund: row.successful_refund_json ?? undefined,
          createdAt: row.created_at ? parseIsoDate(row.created_at) : undefined,
          updatedAt: row.updated_at ? parseIsoDate(row.updated_at) : undefined,
          auditLog: auditByOrderId.get(order.id) ?? []
        };
      });
    },
    async getCatalogItemsForQuote(locationId, itemIds) {
      if (itemIds.length === 0) {
        return new Map<string, QuoteCatalogItem>();
      }

      const rows = await db
        .selectFrom("catalog_menu_items")
        .select(["item_id", "name", "price_cents", "customization_groups_json", "visible"])
        .where("location_id", "=", locationId)
        .where("item_id", "in", itemIds)
        .where("visible", "=", true)
        .execute();

      const items = new Map<string, QuoteCatalogItem>();
      for (const row of rows) {
        items.set(row.item_id, {
          itemId: row.item_id,
          itemName: row.name,
          basePriceCents: row.price_cents,
          customizationGroups: parseCustomizationGroups(row.customization_groups_json)
        });
      }

      return items;
    },
    async getTaxRateBasisPoints(locationId) {
      const row = await db
        .selectFrom("catalog_store_configs")
        .select("tax_rate_basis_points")
        .where("location_id", "=", locationId)
        .executeTakeFirst();

      if (!row) {
        logger.warn(
          {
            locationId,
            fallbackTaxRateBasisPoints: defaultTaxRateBasisPoints
          },
          "catalog store config tax rate missing for location; using default"
        );
        return defaultTaxRateBasisPoints;
      }

      return row.tax_rate_basis_points;
    },
    async pingDb() {
      await sql`SELECT 1`.execute(db);
    },
    async close() {
      await db.destroy();
    }
  };
}

export async function createOrdersRepository(logger: FastifyBaseLogger): Promise<OrdersRepository> {
  const databaseUrl = getDatabaseUrl();
  const allowInMemory = allowsInMemoryPersistence();
  if (!databaseUrl) {
    if (!allowInMemory) {
      throw buildPersistenceStartupError({
        service: "orders",
        reason: "missing_database_url"
      });
    }

    logger.warn({ backend: "memory" }, "orders persistence backend selected with explicit in-memory mode");
    return createInMemoryRepository();
  }

  try {
    const repository = await createPostgresRepository(databaseUrl, logger);
    logger.info({ backend: "postgres" }, "orders persistence backend selected");
    return repository;
  } catch (error) {
    if (!allowInMemory) {
      logger.error({ error }, "failed to initialize postgres persistence");
      throw buildPersistenceStartupError({
        service: "orders",
        reason: "postgres_initialization_failed"
      });
    }

    logger.error({ error }, "failed to initialize postgres persistence; using explicit in-memory fallback");
    return createInMemoryRepository();
  }
}
