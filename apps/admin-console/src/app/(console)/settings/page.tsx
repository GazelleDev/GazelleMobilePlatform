import { getAdminConsoleAuthStatus } from "@/lib/auth";
import { getInternalApiStatus } from "@/lib/internal-api";

export default function SettingsPage() {
  const authStatus = getAdminConsoleAuthStatus();
  const apiStatus = getInternalApiStatus();
  const readyCount = [
    authStatus.hasSessionSecret,
    apiStatus.hasBaseUrl,
    Boolean(apiStatus.clientDashboardUrl)
  ].filter(Boolean).length;
  const overallReady = authStatus.hasSessionSecret && apiStatus.hasBaseUrl;

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Settings</span>
          <h3>Environment readiness</h3>
          <p>These checks make it obvious whether the internal shell can authenticate staff and talk to the provisioning APIs.</p>
        </div>
        <span className={overallReady ? "status-badge is-healthy" : "status-badge is-warning"}>
          {overallReady ? "Environment ready" : "Configuration needed"}
        </span>
      </div>

      <div className="settings-grid">
        <article className="stat-card">
          <span className="eyebrow">Overall</span>
          <strong>{readyCount}/3</strong>
          <p>Core configuration checks currently passing for the admin console.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Auth Gate</span>
          <strong>{authStatus.hasSessionSecret ? "Ready" : "Missing env"}</strong>
          <p>Controlled by the identity-backed admin login path plus the local session-signing secret.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Gateway API</span>
          <strong>{apiStatus.hasBaseUrl ? "Connected" : "Missing base URL"}</strong>
          <p>Uses the internal admin bearer session to reach bootstrap and provisioning APIs through the gateway.</p>
        </article>
      </div>

      <div className="settings-grid">
        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Auth</span>
            <h4>Internal access gate</h4>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Status</dt>
              <dd>{authStatus.configured ? "Configured" : "Missing env"}</dd>
            </div>
            <div>
              <dt>Gateway base URL</dt>
              <dd>{authStatus.hasBaseUrl ? "Present" : "Missing"}</dd>
            </div>
            <div>
              <dt>Identity-backed login</dt>
              <dd>{authStatus.hasBaseUrl ? "Enabled" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Session secret</dt>
              <dd>{authStatus.hasSessionSecret ? "Present" : "Missing"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Gateway API</span>
            <h4>Gateway connection</h4>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Base URL</dt>
              <dd className="env-value">{apiStatus.baseUrl ?? "Missing"}</dd>
            </div>
            <div>
              <dt>Client dashboard URL</dt>
              <dd className="env-value">{apiStatus.clientDashboardUrl ?? "Unset"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Checklist</span>
            <h4>What still matters</h4>
          </div>
          <div className="mini-list">
            <div className="mini-list-item">
              <span className="step-item-index">1</span>
              <div className="mini-list-copy">
                <strong>Identity-backed admin auth</strong>
                <p>Without the gateway base URL and local session secret, the console cannot exchange credentials for an internal-admin session.</p>
              </div>
            </div>
            <div className="mini-list-item">
              <span className="step-item-index">2</span>
              <div className="mini-list-copy">
                <strong>Bootstrap API</strong>
                <p>The gateway origin is what makes client creation, owner provisioning, and launch edits work.</p>
              </div>
            </div>
            <div className="mini-list-item">
              <span className="step-item-index">3</span>
              <div className="mini-list-copy">
                <strong>Dashboard handoff URL</strong>
                <p>The client dashboard URL should be set before you provision owners so the handoff instructions remain complete.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
