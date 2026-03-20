import { normalizeApiBaseUrl, resolveDefaultApiBaseUrl, type OperatorSession } from "./api.js";

const API_BASE_URL_STORAGE_KEY = "gazelle.operator.api-base-url.v1";
const STAFF_TOKEN_STORAGE_KEY = "gazelle.operator.staff-token.v1";
const DASHBOARD_SECTION_STORAGE_KEY = "gazelle.operator.section.v1";

function getStorage() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.localStorage;
}

function normalizeToken(value: string | null) {
  const next = value?.trim();
  return next && next.length > 0 ? next : null;
}

export function loadStoredSession(): OperatorSession | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const staffToken = normalizeToken(storage.getItem(STAFF_TOKEN_STORAGE_KEY));
  if (!staffToken) {
    return null;
  }

  return {
    apiBaseUrl: normalizeApiBaseUrl(storage.getItem(API_BASE_URL_STORAGE_KEY) ?? resolveDefaultApiBaseUrl()),
    staffToken
  };
}

export function persistSession(session: OperatorSession) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(API_BASE_URL_STORAGE_KEY, normalizeApiBaseUrl(session.apiBaseUrl));
  storage.setItem(STAFF_TOKEN_STORAGE_KEY, session.staffToken.trim());
}

export function clearStoredSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(API_BASE_URL_STORAGE_KEY);
  storage.removeItem(STAFF_TOKEN_STORAGE_KEY);
}

export function loadStoredSection(): "orders" | "menu" | "store" {
  const storage = getStorage();
  const nextSection = storage?.getItem(DASHBOARD_SECTION_STORAGE_KEY);
  return nextSection === "menu" || nextSection === "store" ? nextSection : "orders";
}

export function persistSection(section: "orders" | "menu" | "store") {
  const storage = getStorage();
  storage?.setItem(DASHBOARD_SECTION_STORAGE_KEY, section);
}
