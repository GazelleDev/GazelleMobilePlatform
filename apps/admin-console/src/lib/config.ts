function trimToUndefined(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

export function getInternalAdminApiBaseUrl() {
  const baseUrl = trimToUndefined(process.env.INTERNAL_ADMIN_API_BASE_URL);
  if (!baseUrl) {
    throw new Error("INTERNAL_ADMIN_API_BASE_URL must be configured.");
  }

  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export function getOptionalClientDashboardUrl() {
  return trimToUndefined(process.env.ADMIN_CONSOLE_CLIENT_DASHBOARD_URL);
}

export function hasInternalAdminApiBaseUrl() {
  return Boolean(trimToUndefined(process.env.INTERNAL_ADMIN_API_BASE_URL));
}

export function hasAdminConsoleSessionSecret() {
  return Boolean(trimToUndefined(process.env.ADMIN_CONSOLE_SESSION_SECRET));
}

export function readAdminConsoleSessionSecret() {
  const value = trimToUndefined(process.env.ADMIN_CONSOLE_SESSION_SECRET);
  if (!value) {
    throw new Error("ADMIN_CONSOLE_SESSION_SECRET must be configured.");
  }

  return value;
}
