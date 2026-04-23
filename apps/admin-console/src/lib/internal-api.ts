import type {
  InternalOwnerProvisionRequest,
  InternalOwnerProvisionResponse,
  InternalOwnerSummary
} from "@lattelink/contracts-auth";
import type {
  AppConfigStoreCapabilities,
  ClientPaymentProfile,
  InternalLocationBootstrap,
  InternalLocationListResponse,
  InternalLocationSummary,
  StripeConnectLinkResponse
} from "@lattelink/contracts-catalog";
import { requireAdminSession } from "@/lib/auth";
import {
  getClientDashboardUrlStatus,
  getInternalAdminApiBaseUrl,
  getInternalAdminApiBaseUrlStatus,
  getOptionalClientDashboardUrl,
  hasInternalAdminApiBaseUrl
} from "@/lib/config";

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

async function requestInternalApi<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
  const session = await requireAdminSession();
  const response = await fetch(`${getInternalAdminApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${session.accessToken}`,
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

    // Prefix with status code so the client error boundary can detect 401/403
    // without relying on custom error properties (which are stripped on serialization).
    const message = errorBody?.message ?? `Request failed with status ${response.status}.`;
    throw new InternalApiError(`${response.status}: ${message}`, response.status, errorBody?.code);
  }

  return (await response.json()) as TResponse;
}

export function getInternalApiStatus() {
  const baseUrlStatus = getInternalAdminApiBaseUrlStatus();
  const clientDashboardUrlStatus = getClientDashboardUrlStatus();
  return {
    hasBaseUrl: hasInternalAdminApiBaseUrl(),
    baseUrl: hasInternalAdminApiBaseUrl() && baseUrlStatus.valid ? getInternalAdminApiBaseUrl() : null,
    baseUrlStatus,
    clientDashboardUrl: getOptionalClientDashboardUrl(),
    clientDashboardUrlStatus
  };
}

export async function listInternalLocations() {
  return requestInternalApi<InternalLocationListResponse>("/v1/internal/locations");
}

export async function getInternalLocation(locationId: string) {
  return requestInternalApi<InternalLocationSummary>(`/v1/internal/locations/${locationId}`);
}

export async function getInternalLocationPaymentProfile(locationId: string) {
  return requestInternalApi<ClientPaymentProfile>(`/v1/internal/locations/${locationId}/payment-profile`);
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

export async function createStripeOnboardingLink(locationId: string, input: { returnUrl: string; refreshUrl: string }) {
  return requestInternalApi<StripeConnectLinkResponse>(`/v1/internal/locations/${locationId}/stripe/onboarding-link`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function createStripeDashboardLink(locationId: string) {
  return requestInternalApi<StripeConnectLinkResponse>(`/v1/internal/locations/${locationId}/stripe/dashboard-link`, {
    method: "POST",
    body: JSON.stringify({})
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
