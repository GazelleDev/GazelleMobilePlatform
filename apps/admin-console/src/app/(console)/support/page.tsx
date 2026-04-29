import Link from "next/link";
import {
  InternalApiError,
  listInternalLocations,
  lookupSupportOrders,
  type SupportOrderLookupResponse,
  type SupportOrderLookupResult
} from "@/lib/internal-api";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountCents / 100);
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getCustomerLabel(result: SupportOrderLookupResult) {
  return result.customer?.email ?? result.customer?.phone ?? result.customer?.name ?? result.userId ?? "Unknown customer";
}

async function safeLookupSupportOrders(input: {
  query: string;
  locationId?: string;
  limit?: number;
}): Promise<{ lookup: SupportOrderLookupResponse; error?: string }> {
  try {
    return {
      lookup: await lookupSupportOrders(input)
    };
  } catch (error) {
    if (error instanceof InternalApiError) {
      return {
        lookup: { results: [] },
        error: error.message
      };
    }

    throw error;
  }
}

export default async function SupportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const query = getParam(params.query)?.trim() ?? "";
  const locationId = getParam(params.locationId)?.trim() ?? "";
  const [{ locations }, lookupResult] = await Promise.all([
    listInternalLocations(),
    query.length > 0
      ? safeLookupSupportOrders({
          query,
          locationId: locationId || undefined,
          limit: 25
        })
      : Promise.resolve<{ lookup: SupportOrderLookupResponse; error?: string }>({ lookup: { results: [] } })
  ]);
  const lookup = lookupResult.lookup;

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Support</span>
          <h3>Order lookup</h3>
          <p>Search by phone number, customer name/email, pickup code, order ID, payment ID, or Stripe PaymentIntent.</p>
        </div>
        <div className="page-tools">
          <Link href="/dashboard" className="secondary-button">
            Back to Dashboard
          </Link>
        </div>
      </div>

      <section className="panel">
        <form className="form-grid" action="/support">
          <label>
            <span>Lookup query</span>
            <input name="query" placeholder="Phone, name, email, pickup code, order ID, or payment ID" defaultValue={query} required />
          </label>
          <label>
            <span>Location filter</span>
            <select name="locationId" defaultValue={locationId}>
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.locationId} value={location.locationId}>
                  {location.brandName} · {location.locationName}
                </option>
              ))}
            </select>
          </label>
          <div className="form-actions">
            <button type="submit" className="primary-button">
              Search Orders
            </button>
          </div>
        </form>
      </section>

      <section className="panel table-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Results</span>
            <h4>{query ? `${lookup.results.length} result${lookup.results.length === 1 ? "" : "s"}` : "Search required"}</h4>
          </div>
        </div>

        {lookupResult.error ? (
          <div className="empty-state">
            <h4>Support lookup failed.</h4>
            <p>{lookupResult.error}</p>
            <p>Check Sentry and retry after the backend issue is resolved.</p>
          </div>
        ) : !query ? (
          <div className="empty-state">
            <h4>Enter a lookup query.</h4>
            <p>Use this before querying the database manually during pilot support.</p>
          </div>
        ) : lookup.results.length === 0 ? (
          <div className="empty-state">
            <h4>No matching orders found.</h4>
            <p>Try removing the location filter or searching by phone, email, pickup code, order ID, or payment ID.</p>
          </div>
        ) : (
          <div className="support-results">
            {lookup.results.map((result) => (
              <article key={result.order.id} className="support-order-card">
                <div className="support-order-card__header">
                  <div>
                    <span className="eyebrow">{result.order.locationId}</span>
                    <h4>{result.order.id}</h4>
                    <p className="subtle-copy">{getCustomerLabel(result)}</p>
                  </div>
                  <div className={`status-badge is-${result.order.status === "CANCELED" ? "critical" : "healthy"}`}>
                    {result.order.status}
                  </div>
                </div>

                <dl className="detail-grid">
                  <div>
                    <dt>Total</dt>
                    <dd>{formatMoney(result.order.total.amountCents, result.order.total.currency)}</dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd>{result.paymentProvider ?? "Unknown"} {result.paymentStatus ? `· ${result.paymentStatus}` : ""}</dd>
                  </div>
                  <div>
                    <dt>Payment ID</dt>
                    <dd>{result.paymentIntentId ?? result.paymentId ?? "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDate(result.createdAt)}</dd>
                  </div>
                </dl>

                <div className="audit-log">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Audit Trail</span>
                      <h4>{result.auditLog.length} event{result.auditLog.length === 1 ? "" : "s"}</h4>
                    </div>
                  </div>
                  {result.auditLog.length === 0 ? (
                    <p className="subtle-copy">No audit events recorded for this order yet.</p>
                  ) : (
                    result.auditLog.map((entry) => (
                      <div key={entry.logId} className="audit-log__entry">
                        <div>
                          <strong>{entry.action}</strong>
                          <span>{entry.actorType} · {entry.actorId}</span>
                        </div>
                        <time>{formatDate(entry.occurredAt)}</time>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
