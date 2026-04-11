import Link from "next/link";
import { getInternalLocationOwner, listInternalLocations } from "@/lib/internal-api";

export default async function LaunchReadinessPage() {
  const locations = (await listInternalLocations()).locations;
  const readinessRows = await Promise.all(
    locations.map(async (location) => ({
      location,
      owner: await getInternalLocationOwner(location.locationId).catch(() => ({ locationId: location.locationId, owner: null }))
    }))
  );
  const rows = readinessRows.map(({ location, owner }) => {
    const issues = [
      !owner.owner,
      !location.capabilities.operations.dashboardEnabled,
      !location.capabilities.operations.liveOrderTrackingEnabled
    ].filter(Boolean).length;

    const launchState = issues === 0 ? "healthy" : issues === 1 ? "warning" : "critical";

    return {
      location,
      owner,
      launchState
    };
  });

  const healthyCount = rows.filter((row) => row.launchState === "healthy").length;
  const warningCount = rows.filter((row) => row.launchState === "warning").length;
  const criticalCount = rows.filter((row) => row.launchState === "critical").length;

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Launch Readiness</span>
          <h3>Client launch status</h3>
          <p>Use this view to spot missing owner access or disabled launch-critical capabilities before handoff.</p>
        </div>
        <Link href="/clients/new" className="primary-button">
          Create Client
        </Link>
      </div>

      <div className="stat-grid">
        <article className="stat-card">
          <span className="eyebrow">Visible Clients</span>
          <strong>{rows.length}</strong>
          <p>All locations currently under launch review in the internal console.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Ready</span>
          <strong>{healthyCount}</strong>
          <p>Locations with owner access, dashboard access, and live tracking already configured.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Attention</span>
          <strong>{warningCount}</strong>
          <p>Locations that are close to handoff but still missing one launch-critical setting.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Blocked</span>
          <strong>{criticalCount}</strong>
          <p>Locations with multiple missing requirements that need admin follow-up.</p>
        </article>
      </div>

      <section className="panel">
        {rows.length === 0 ? (
          <div className="empty-state">
            <h4>No launch records yet.</h4>
            <p>Create a client before using the readiness board.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Owner</th>
                <th>Dashboard</th>
                <th>Tracking</th>
                <th>Loyalty</th>
                <th>Launch State</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ location, owner, launchState }) => (
                <tr key={location.locationId}>
                  <td>
                    <div className="grid-table-meta">
                      <strong>{location.brandName}</strong>
                      <p>
                        {location.locationName} · {location.marketLabel}
                      </p>
                    </div>
                  </td>
                  <td>{owner.owner ? owner.owner.email : "Missing owner"}</td>
                  <td>{location.capabilities.operations.dashboardEnabled ? "Enabled" : "Disabled"}</td>
                  <td>{location.capabilities.operations.liveOrderTrackingEnabled ? "Enabled" : "Disabled"}</td>
                  <td>{location.capabilities.loyalty.visible ? "Visible" : "Hidden"}</td>
                  <td>
                    <span className={`status-badge is-${launchState}`}>
                      {launchState === "healthy" ? "Ready" : launchState === "warning" ? "Attention" : "Blocked"}
                    </span>
                  </td>
                  <td>
                    <Link href={`/clients/${location.locationId}`} className="table-link">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
