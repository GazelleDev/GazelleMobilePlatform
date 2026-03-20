import { GazelleApiClient } from "@gazelle/sdk-mobile";

const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:8080/v1";
const DEFAULT_LOCAL_CATALOG_API_BASE_URL = "http://127.0.0.1:3002/v1";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_LOCAL_API_BASE_URL;
export const CATALOG_API_BASE_URL =
  process.env.EXPO_PUBLIC_CATALOG_SERVICE_BASE_URL ??
  process.env.EXPO_PUBLIC_CATALOG_API_BASE_URL ??
  DEFAULT_LOCAL_CATALOG_API_BASE_URL;

export const apiClient = new GazelleApiClient({
  baseUrl: API_BASE_URL
});

export const catalogApiClient = new GazelleApiClient({
  baseUrl: CATALOG_API_BASE_URL
});
