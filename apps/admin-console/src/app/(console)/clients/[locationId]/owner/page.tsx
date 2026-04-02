import { notFound } from "next/navigation";
import { reprovisionOwnerAction } from "@/app/actions";
import { getInternalLocation, getInternalLocationOwner, InternalApiError } from "@/lib/internal-api";

type ClientOwnerPageProps = {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientOwnerPage({ params, searchParams }: ClientOwnerPageProps) {
  const { locationId } = await params;
  const query = await searchParams;
  const updated = typeof query.updated === "string" ? query.updated : undefined;
  const error = typeof query.error === "string" ? query.error : undefined;

  try {
    const [location, ownerSummary] = await Promise.all([
      getInternalLocation(locationId),
      getInternalLocationOwner(locationId)
    ]);

    return (
      <section className="page-stack">
        <div className="page-header">
          <div>
            <span className="eyebrow">Owner Access</span>
            <h3>{location.brandName}</h3>
            <p>Provision or rotate the first client dashboard owner without touching the database manually.</p>
          </div>
        </div>

        <section className="panel">
          {updated ? <p className="inline-message inline-message-success">Owner access updated.</p> : null}
          {error ? <p className="inline-message inline-message-error">{error}</p> : null}

          {ownerSummary.owner ? (
            <div className="owner-summary">
              <div>
                <span className="eyebrow">Current owner</span>
                <strong>{ownerSummary.owner.displayName}</strong>
                <p>{ownerSummary.owner.email}</p>
              </div>
              <span className={ownerSummary.owner.active ? "status-pill is-live" : "status-pill is-muted"}>
                {ownerSummary.owner.active ? "Active" : "Inactive"}
              </span>
            </div>
          ) : (
            <p className="inline-message inline-message-warning">No owner exists yet for this client.</p>
          )}

          <form action={reprovisionOwnerAction} className="stack-form">
            <input type="hidden" name="locationId" value={location.locationId} />
            <div className="field-grid">
              <label className="field">
                <span>Display name</span>
                <input name="displayName" defaultValue={ownerSummary.owner?.displayName ?? ""} required />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" defaultValue={ownerSummary.owner?.email ?? ""} required />
              </label>
              <label className="field">
                <span>Temporary password</span>
                <input name="temporaryPassword" type="password" placeholder="Leave blank to auto-generate" />
              </label>
              <label className="field">
                <span>Client dashboard URL</span>
                <input name="dashboardUrl" placeholder="https://client.example.com" />
              </label>
            </div>

            <div className="form-actions">
              <button type="submit" className="primary-button">
                Save Owner Access
              </button>
            </div>
          </form>
        </section>
      </section>
    );
  } catch (error) {
    if (error instanceof InternalApiError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }
}
