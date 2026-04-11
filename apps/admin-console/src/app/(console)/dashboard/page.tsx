import Link from "next/link";
import { getInternalLocationOwner, listInternalLocations } from "@/lib/internal-api";

type LaunchState = "healthy" | "warning" | "critical";

function getLaunchState(input: {
  hasOwner: boolean;
  dashboardEnabled: boolean;
  liveTrackingEnabled: boolean;
}): LaunchState {
  let issues = 0;

  if (!input.hasOwner) {
    issues += 1;
  }
  if (!input.dashboardEnabled) {
    issues += 1;
  }
  if (!input.liveTrackingEnabled) {
    issues += 1;
  }

  if (issues === 0) {
    return "healthy";
  }

  if (issues === 1) {
    return "warning";
  }

  return "critical";
}

function getLaunchLabel(state: LaunchState) {
  switch (state) {
    case "healthy":
      return "Ready";
    case "warning":
      return "Attention";
    default:
      return "Blocked";
  }
}

function getActivityFeed(rows: Array<{
  brandName: string;
  locationId: string;
  hasOwner: boolean;
  dashboardEnabled: boolean;
  liveTrackingEnabled: boolean;
  menuSource: "platform_managed" | "external_sync";
}>) {
  const items = rows.flatMap((row) => {
    const nextItems = [];

    if (!row.hasOwner) {
      nextItems.push({
        severity: "danger" as const,
        label: `${row.brandName} is missing owner access`,
        detail: `${row.locationId} needs the first dashboard owner provisioned before handoff.`
      });
    }

    if (!row.dashboardEnabled) {
      nextItems.push({
        severity: "warning" as const,
        label: `${row.brandName} has the client dashboard disabled`,
        detail: `Operators will not be able to use the dashboard until the location capabilities are updated.`
      });
    }

    if (!row.liveTrackingEnabled) {
      nextItems.push({
        severity: "warning" as const,
        label: `${row.brandName} has live order tracking disabled`,
        detail: `The launch baseline is incomplete for this location's operations setup.`
      });
    }

    if (row.menuSource === "external_sync") {
      nextItems.push({
        severity: "info" as const,
        label: `${row.brandName} is using an external menu source`,
        detail: `Dashboard editing will stay constrained until the menu source returns to platform managed.`
      });
    }

    return nextItems;
  });

  if (items.length > 0) {
    return items.slice(0, 8);
  }

  return [
    {
      severity: "info" as const,
      label: "All visible clients meet the current launch baseline",
      detail: "Owner access, dashboard availability, and live order tracking are all configured."
    }
  ];
}

export default async function DashboardPage() {
  const locations = (await listInternalLocations()).locations;
  const ownerSummaries = await Promise.all(
    locations.map(async (location) => ({
      locationId: location.locationId,
      ownerSummary: await getInternalLocationOwner(location.locationId).catch(() => ({
        locationId: location.locationId,
        owner: null
      }))
    }))
  );

  const ownerByLocationId = new Map(ownerSummaries.map((summary) => [summary.locationId, summary.ownerSummary.owner]));

  const rows = locations.map((location) => {
    const owner = ownerByLocationId.get(location.locationId) ?? null;
    const launchState = getLaunchState({
      hasOwner: Boolean(owner),
      dashboardEnabled: location.capabilities.operations.dashboardEnabled,
      liveTrackingEnabled: location.capabilities.operations.liveOrderTrackingEnabled
    });

    return {
      location,
      owner,
      launchState
    };
  });

  const readyCount = rows.filter((row) => row.launchState === "healthy").length;
  const warningCount = rows.filter((row) => row.launchState === "warning").length;
  const criticalCount = rows.filter((row) => row.launchState === "critical").length;
  const dashboardEnabledCount = rows.filter((row) => row.location.capabilities.operations.dashboardEnabled).length;
  const activityFeed = getActivityFeed(
    rows.map((row) => ({
      brandName: row.location.brandName,
      locationId: row.location.locationId,
      hasOwner: Boolean(row.owner),
      dashboardEnabled: row.location.capabilities.operations.dashboardEnabled,
      liveTrackingEnabled: row.location.capabilities.operations.liveOrderTrackingEnabled,
      menuSource: row.location.capabilities.menu.source
    }))
  );

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h3>Platform overview</h3>
          <p>Start from the launch baseline, then drill into the clients that still need operator access or capability work.</p>
        </div>
        <div className="page-tools">
          <Link href="/clients" className="secondary-button">
            View Clients
          </Link>
          <Link href="/clients/new" className="primary-button">
            Create Client
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        <article className="stat-card">
          <span className="eyebrow">Visible Clients</span>
          <strong>{locations.length}</strong>
          <p>Internal locations currently exposed by the bootstrap APIs.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Launch Ready</span>
          <strong>{readyCount}</strong>
          <p>Clients with owner access, dashboard access, and live tracking configured.</p>
          <span className={readyCount === locations.length ? "metric-delta is-positive" : "metric-delta"}>
            {locations.length === 0 ? "No clients yet" : `${readyCount} of ${locations.length} ready`}
          </span>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Needs Attention</span>
          <strong>{warningCount + criticalCount}</strong>
          <p>Locations that still have at least one launch-critical gap.</p>
          <span className={(criticalCount > 0 ? "metric-delta is-danger" : "metric-delta is-warning")}>
            {criticalCount > 0 ? `${criticalCount} blocked` : `${warningCount} in review`}
          </span>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Dashboard Enabled</span>
          <strong>{dashboardEnabledCount}</strong>
          <p>Locations where the client dashboard can be handed off today.</p>
        </article>
      </div>

      <div className="dashboard-layout">
        <section className="panel table-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Readiness</span>
              <h4>Client launch state</h4>
            </div>
            <Link href="/launch-readiness" className="table-link">
              Open readiness board
            </Link>
          </div>

          {rows.length === 0 ? (
            <div className="empty-state">
              <h4>No client locations yet.</h4>
              <p>Create the first client to populate the launch dashboard.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Market</th>
                  <th>Owner</th>
                  <th>Menu</th>
                  <th>Dashboard</th>
                  <th>Launch State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.location.locationId}>
                    <td>
                      <strong>{row.location.brandName}</strong>
                      <span>{row.location.locationName}</span>
                    </td>
                    <td>{row.location.marketLabel}</td>
                    <td>{row.owner ? row.owner.email : "Missing owner"}</td>
                    <td>
                      <span className={row.location.capabilities.menu.source === "platform_managed" ? "menu-badge" : "menu-badge is-external"}>
                        {row.location.capabilities.menu.source === "platform_managed" ? "Platform" : "External"}
                      </span>
                    </td>
                    <td>{row.location.capabilities.operations.dashboardEnabled ? "Enabled" : "Disabled"}</td>
                    <td>
                      <div className={`status-badge is-${row.launchState}`}>
                        {getLaunchLabel(row.launchState)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Activity</span>
              <h4>Operational notes</h4>
            </div>
          </div>

          <div className="activity-feed">
            {activityFeed.map((item) => (
              <div key={`${item.label}-${item.detail}`} className="feed-row">
                <span className={`feed-dot is-${item.severity}`} />
                <div>
                  <strong>{item.label}</strong>
                  <p className="subtle-copy">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
