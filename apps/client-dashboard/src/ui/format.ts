export function escapeHtml(value: string | number | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatMoney(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
}

export function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString();
}

export function formatRelativeRefresh(value: number | null, loading: boolean) {
  if (value === null) {
    return loading ? "Refreshing…" : "Not refreshed yet";
  }
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
  return deltaSeconds < 60
    ? `Updated ${deltaSeconds}s ago`
    : `Updated ${Math.floor(deltaSeconds / 60)}m ago`;
}

export function formatCompactCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompactMoney(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

export function formatDashboardDate() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date());
}

export function getOperatorInitials(name: string | undefined) {
  const tokens = (name ?? "Client")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, 2);
  return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("") || "OP";
}

export function parseIntegerOrFallback(value: string, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
