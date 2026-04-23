function trimToUndefined(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

type UrlStatus = {
  present: boolean;
  valid: boolean;
  https: boolean;
  safeForProduction: boolean;
  value: string | null;
};

type SecretStatus = {
  present: boolean;
  strong: boolean;
};

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function analyzeUrl(value: string | undefined): UrlStatus {
  const trimmed = trimToUndefined(value);
  if (!trimmed) {
    return {
      present: false,
      valid: false,
      https: false,
      safeForProduction: false,
      value: null
    };
  }

  try {
    const parsed = new URL(trimmed);
    const https = parsed.protocol === "https:";
    const safeForProduction = https || isLocalHostname(parsed.hostname);
    return {
      present: true,
      valid: true,
      https,
      safeForProduction,
      value: parsed.toString().replace(/\/$/, "")
    };
  } catch {
    return {
      present: true,
      valid: false,
      https: false,
      safeForProduction: false,
      value: trimmed
    };
  }
}

function analyzeSecret(value: string | undefined): SecretStatus {
  const trimmed = trimToUndefined(value);
  return {
    present: Boolean(trimmed),
    strong: Boolean(trimmed && trimmed.length >= 32)
  };
}

export function getInternalAdminApiBaseUrl() {
  const status = analyzeUrl(process.env.INTERNAL_ADMIN_API_BASE_URL);
  if (!status.present || !status.value) {
    throw new Error("INTERNAL_ADMIN_API_BASE_URL must be configured.");
  }
  if (!status.valid) {
    throw new Error("INTERNAL_ADMIN_API_BASE_URL must be a valid URL.");
  }
  if (process.env.NODE_ENV === "production" && !status.safeForProduction) {
    throw new Error("INTERNAL_ADMIN_API_BASE_URL must use HTTPS in production.");
  }

  return status.value;
}

export function getOptionalClientDashboardUrl() {
  const status = analyzeUrl(process.env.ADMIN_CONSOLE_CLIENT_DASHBOARD_URL);
  return status.valid ? status.value : null;
}

export function hasInternalAdminApiBaseUrl() {
  return analyzeUrl(process.env.INTERNAL_ADMIN_API_BASE_URL).present;
}

export function hasAdminConsoleSessionSecret() {
  return analyzeSecret(process.env.ADMIN_CONSOLE_SESSION_SECRET).present;
}

export function readAdminConsoleSessionSecret() {
  const value = trimToUndefined(process.env.ADMIN_CONSOLE_SESSION_SECRET);
  if (!value) {
    throw new Error("ADMIN_CONSOLE_SESSION_SECRET must be configured.");
  }

  return value;
}

export function getInternalAdminApiBaseUrlStatus() {
  return analyzeUrl(process.env.INTERNAL_ADMIN_API_BASE_URL);
}

export function getClientDashboardUrlStatus() {
  return analyzeUrl(process.env.ADMIN_CONSOLE_CLIENT_DASHBOARD_URL);
}

export function getAdminConsoleSessionSecretStatus() {
  return analyzeSecret(process.env.ADMIN_CONSOLE_SESSION_SECRET);
}
