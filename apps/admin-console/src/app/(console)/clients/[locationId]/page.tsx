import Link from "next/link";
import { notFound } from "next/navigation";
import { getInternalLocation, getInternalLocationOwner, InternalApiError } from "@/lib/internal-api";

type ClientDetailPageProps = {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientDetailPage({ params, searchParams }: ClientDetailPageProps) {
  const { locationId } = await params;
  const query = await searchParams;
  const created = typeof query.created === "string" ? query.created : undefined;

  try {
    const [location, ownerSummary] = await Promise.all([
      getInternalLocation(locationId),
      getInternalLocationOwner(locationId)
    ]);

    const hasOwner = Boolean(ownerSummary.owner);
    const issues = [
      !location.capabilities.operations.dashboardEnabled,
      !hasOwner,
      !location.capabilities.operations.liveOrderTrackingEnabled
    ].filter(Boolean).length;

    const launchState = issues === 0 ? "healthy" : issues === 1 ? "warning" : "critical";
    const launchLabel = launchState === "healthy" ? "Launch ready" : launchState === "warning" ? "Needs attention" : "Blocked";

    const readiness = [
      { label: "Location configured", ready: true },
      { label: "Stripe mobile payments ready", ready: location.paymentReadiness?.ready ?? false },
      { label: "Client dashboard enabled", ready: location.capabilities.operations.dashboardEnabled },
      { label: "Owner access configured", ready: Boolean(ownerSummary.owner) },
      { label: "Live order tracking configured", ready: location.capabilities.operations.liveOrderTrackingEnabled }
    ];

    return (
      <section className="page-stack">
        <div className="page-header">
          <div>
            <span className="eyebrow">{location.marketLabel}</span>
            <h3>{location.brandName}</h3>
            <p>
              {location.locationName} · {location.locationId}
            </p>
          </div>
          <div className="page-tools">
            <span className={`status-badge is-${launchState}`}>{launchLabel}</span>
            <Link href={`/clients/${locationId}/capabilities`} className="secondary-button">
              Edit Capabilities
            </Link>
            <Link href={`/clients/${locationId}/owner`} className="primary-button">
              Manage Owner
            </Link>
          </div>
        </div>

        {created ? <p className="inline-message inline-message-success">Client created and owner access is ready.</p> : null}

        <div className="stat-grid">
          <article className="stat-card">
            <span className="eyebrow">Owner Access</span>
            <strong>{ownerSummary.owner ? ownerSummary.owner.displayName : "Missing"}</strong>
            <p>{ownerSummary.owner ? ownerSummary.owner.email : "This location still needs its first dashboard owner."}</p>
          </article>
          <article className="stat-card">
            <span className="eyebrow">Menu Source</span>
            <strong>{location.capabilities.menu.source === "platform_managed" ? "Platform" : "External"}</strong>
            <p>
              {location.capabilities.menu.source === "platform_managed"
                ? "Menu edits can be driven from the LatteLink dashboard."
                : "Dashboard menu editing is constrained by external sync."}
            </p>
          </article>
          <article className="stat-card">
            <span className="eyebrow">Payments</span>
            <strong>{location.paymentReadiness?.ready ? "Ready" : "Needs setup"}</strong>
            <p>
              {location.paymentProfile?.stripeAccountId
                ? `Stripe account ${location.paymentProfile.stripeAccountId}`
                : "No Stripe account linked to this location yet."}
            </p>
          </article>
          <article className="stat-card">
            <span className="eyebrow">Fulfillment</span>
            <strong>{location.capabilities.operations.fulfillmentMode === "staff" ? "Staff" : "Time based"}</strong>
            <p>Operational handoff should match the configured store fulfillment model.</p>
          </article>
        </div>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <span className="eyebrow">Business</span>
              <h4>Client summary</h4>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Brand ID</dt>
                <dd>{location.brandId}</dd>
              </div>
              <div>
                <dt>Location ID</dt>
                <dd>{location.locationId}</dd>
              </div>
              <div>
                <dt>Store name</dt>
                <dd>{location.storeName}</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>{location.hours}</dd>
              </div>
              <div>
                <dt>Pickup</dt>
                <dd>{location.pickupInstructions}</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <div className="section-heading">
              <span className="eyebrow">Operations</span>
              <h4>Capability overview</h4>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Dashboard access</dt>
                <dd>{location.capabilities.operations.dashboardEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Live order tracking</dt>
                <dd>{location.capabilities.operations.liveOrderTrackingEnabled ? "Enabled" : "Disabled"}</dd>
              </div>
              <div>
                <dt>Menu source</dt>
                <dd>{location.capabilities.menu.source === "platform_managed" ? "Platform managed" : "External sync"}</dd>
              </div>
              <div>
                <dt>Fulfillment mode</dt>
                <dd>{location.capabilities.operations.fulfillmentMode === "staff" ? "Staff managed" : "Time based"}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="detail-grid">
          <section className="panel">
            <div className="section-heading">
              <span className="eyebrow">Owner</span>
              <h4>Handoff summary</h4>
            </div>
            {ownerSummary.owner ? (
              <dl className="detail-list">
                <div>
                  <dt>Name</dt>
                  <dd>{ownerSummary.owner.displayName}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{ownerSummary.owner.email}</dd>
                </div>
                <div>
                  <dt>Role</dt>
                  <dd>{ownerSummary.owner.role}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{ownerSummary.owner.active ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
            ) : (
              <p className="inline-message inline-message-warning">
                No owner is assigned to this location yet. Use the owner screen before the dashboard handoff.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="section-heading">
              <span className="eyebrow">Actions</span>
              <h4>Next steps</h4>
            </div>
            <div className="quick-grid">
              <Link href={`/clients/${locationId}/capabilities`} className="action-card">
                <strong>Edit capabilities</strong>
                <p className="subtle-copy">Adjust dashboard access, fulfillment mode, menu source, and loyalty visibility.</p>
              </Link>
              <Link href={`/clients/${locationId}/owner`} className="action-card">
                <strong>Provision owner</strong>
                <p className="subtle-copy">Create or rotate the first client dashboard account for this location.</p>
              </Link>
              <Link href={`/clients/${locationId}/payments`} className="action-card">
                <strong>Manage payments</strong>
                <p className="subtle-copy">Create Stripe onboarding links, confirm readiness, and open Express.</p>
              </Link>
              <Link href="/launch-readiness" className="action-card">
                <strong>Open readiness board</strong>
                <p className="subtle-copy">Compare this location against the rest of the launch pipeline from one view.</p>
              </Link>
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Readiness</span>
            <h4>Launch checklist</h4>
          </div>
          <div className="checklist">
            {readiness.map((item) => (
              <div key={item.label} className={item.ready ? "check-item is-ready" : "check-item is-blocked"}>
                <strong>{item.label}</strong>
                <span>{item.ready ? "Ready" : "Needs attention"}</span>
              </div>
            ))}
          </div>
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
