import type { InternalOwnerProvisionRequest, InternalOwnerProvisionResponse, InternalOwnerSummary } from "@gazelle/contracts-auth";
import type {
  AppConfigStoreCapabilities,
  InternalLocationBootstrap,
  InternalLocationListResponse,
  InternalLocationSummary
} from "@gazelle/contracts-catalog";

type InternalApiErrorBody = {
  code?: string;
  message?: string;
};

export class InternalApiError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = "InternalApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function trimToUndefined(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

function getBaseUrl() {
  const baseUrl = trimToUndefined(process.env.INTERNAL_ADMIN_API_BASE_URL);
  if (!baseUrl) {
    throw new Error("INTERNAL_ADMIN_API_BASE_URL must be configured.");
  }

  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function getApiToken() {
  const token = trimToUndefined(process.env.INTERNAL_ADMIN_API_TOKEN);
  if (!token) {
    throw new Error("INTERNAL_ADMIN_API_TOKEN must be configured.");
  }

  return token;
}

async function requestInternalApi<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-internal-admin-token": getApiToken(),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let errorBody: InternalApiErrorBody | undefined;
    try {
      errorBody = (await response.json()) as InternalApiErrorBody;
    } catch {
      errorBody = undefined;
    }

    throw new InternalApiError(
      errorBody?.message ?? `Internal API request failed with status ${response.status}.`,
      response.status,
      errorBody?.code
    );
  }

  return (await response.json()) as TResponse;
}

export function getInternalApiStatus() {
  return {
    hasBaseUrl: Boolean(trimToUndefined(process.env.INTERNAL_ADMIN_API_BASE_URL)),
    hasToken: Boolean(trimToUndefined(process.env.INTERNAL_ADMIN_API_TOKEN)),
    baseUrl: trimToUndefined(process.env.INTERNAL_ADMIN_API_BASE_URL) ?? null,
    clientDashboardUrl: trimToUndefined(process.env.ADMIN_CONSOLE_CLIENT_DASHBOARD_URL) ?? null
  };
}

export async function listInternalLocations() {
  return requestInternalApi<InternalLocationListResponse>("/v1/internal/locations");
}

export async function getInternalLocation(locationId: string) {
  return requestInternalApi<InternalLocationSummary>(`/v1/internal/locations/${locationId}`);
}

export async function getInternalLocationOwner(locationId: string) {
  return requestInternalApi<InternalOwnerSummary>(`/v1/internal/locations/${locationId}/owner`);
}

export async function bootstrapInternalLocation(input: InternalLocationBootstrap) {
  return requestInternalApi<InternalLocationSummary>("/v1/internal/locations/bootstrap", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function provisionLocationOwner(locationId: string, input: InternalOwnerProvisionRequest) {
  return requestInternalApi<InternalOwnerProvisionResponse>(`/v1/internal/locations/${locationId}/owner/provision`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function buildCapabilities(input: {
  menuSource: AppConfigStoreCapabilities["menu"]["source"];
  fulfillmentMode: AppConfigStoreCapabilities["operations"]["fulfillmentMode"];
  liveOrderTrackingEnabled: boolean;
  dashboardEnabled: boolean;
  loyaltyVisible: boolean;
}): AppConfigStoreCapabilities {
  return {
    menu: {
      source: input.menuSource
    },
    operations: {
      fulfillmentMode: input.fulfillmentMode,
      liveOrderTrackingEnabled: input.liveOrderTrackingEnabled,
      dashboardEnabled: input.dashboardEnabled
    },
    loyalty: {
      visible: input.loyaltyVisible
    }
  };
}
