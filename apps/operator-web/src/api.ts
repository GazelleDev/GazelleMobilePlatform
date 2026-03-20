import { z } from "zod";
import {
  adminMenuItemSchema,
  adminMenuResponseSchema,
  adminStoreConfigSchema,
  appConfigSchema
} from "@gazelle/contracts-catalog";
import { orderSchema } from "@gazelle/contracts-orders";
import { normalizeMenuItemForm, normalizeStoreConfigForm, type OperatorOrder } from "./model.js";

const ordersSchema = z.array(orderSchema);

export type OperatorSession = {
  apiBaseUrl: string;
  staffToken: string;
};

export type OperatorDashboardSnapshot = {
  appConfig: z.output<typeof appConfigSchema>;
  orders: OperatorOrder[];
  menu: z.output<typeof adminMenuResponseSchema>;
  storeConfig: z.output<typeof adminStoreConfigSchema>;
};

function trimToUndefined(value: string | undefined | null) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

function parseJsonSafely(rawValue: string): unknown {
  if (!rawValue) {
    return undefined;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch {
    return rawValue;
  }
}

export function normalizeApiBaseUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }

  return trimmed.replace(/\/+$/, "").endsWith("/v1") ? trimmed.replace(/\/+$/, "") : `${trimmed.replace(/\/+$/, "")}/v1`;
}

export function resolveDefaultApiBaseUrl() {
  return normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL);
}

export function buildStaffHeaders(token: string, includeJsonContentType = false): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
    "x-staff-token": token
  };

  if (includeJsonContentType) {
    headers["content-type"] = "application/json";
  }

  return headers;
}

export function extractApiErrorMessage(payload: unknown, statusCode: number) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = trimToUndefined(String((payload as { message?: unknown }).message ?? ""));
    if (message) {
      return message;
    }
  }

  return `Request failed (${statusCode})`;
}

async function requestJson<TSchema extends z.ZodTypeAny>(params: {
  session: OperatorSession;
  path: string;
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  schema: TSchema;
}): Promise<z.output<TSchema>> {
  const { session, path, method = "GET", body, schema } = params;
  const response = await fetch(`${session.apiBaseUrl}${path}`, {
    method,
    headers: buildStaffHeaders(session.staffToken, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const parsedPayload = parseJsonSafely(await response.text());
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(parsedPayload, response.status));
  }

  return schema.parse(parsedPayload);
}

export async function fetchOperatorSnapshot(session: OperatorSession): Promise<OperatorDashboardSnapshot> {
  const [appConfig, orders, menu, storeConfig] = await Promise.all([
    requestJson({
      session,
      path: "/app-config",
      schema: appConfigSchema
    }),
    requestJson({
      session,
      path: "/admin/orders",
      schema: ordersSchema
    }),
    requestJson({
      session,
      path: "/admin/menu",
      schema: adminMenuResponseSchema
    }),
    requestJson({
      session,
      path: "/admin/store/config",
      schema: adminStoreConfigSchema
    })
  ]);

  return {
    appConfig,
    orders: orders as OperatorOrder[],
    menu,
    storeConfig
  };
}

export function updateOperatorOrderStatus(
  session: OperatorSession,
  orderId: string,
  input: {
    status: "IN_PREP" | "READY" | "COMPLETED" | "CANCELED";
    note?: string;
  }
) {
  return requestJson({
    session,
    path: `/admin/orders/${orderId}/status`,
    method: "POST",
    body: {
      status: input.status,
      ...(trimToUndefined(input.note) ? { note: trimToUndefined(input.note) } : {})
    },
    schema: orderSchema
  });
}

export function updateOperatorMenuItem(
  session: OperatorSession,
  itemId: string,
  input: Parameters<typeof normalizeMenuItemForm>[0]
) {
  return requestJson({
    session,
    path: `/admin/menu/${itemId}`,
    method: "PUT",
    body: normalizeMenuItemForm(input),
    schema: adminMenuItemSchema
  });
}

export function updateOperatorStoreConfig(
  session: OperatorSession,
  input: Parameters<typeof normalizeStoreConfigForm>[0]
) {
  return requestJson({
    session,
    path: "/admin/store/config",
    method: "PUT",
    body: normalizeStoreConfigForm(input),
    schema: adminStoreConfigSchema
  });
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8080/v1";
