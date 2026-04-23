import { getAdminConsoleAuthStatus } from "@/lib/auth";
import { getInternalApiStatus } from "@/lib/internal-api";

export default function SettingsPage() {
  const authStatus = getAdminConsoleAuthStatus();
  const apiStatus = getInternalApiStatus();
  const vercelReady = authStatus.sessionSecretStrong && apiStatus.baseUrlStatus.safeForProduction;
  const readyCount = [
    authStatus.hasSessionSecret,
    authStatus.sessionSecretStrong,
    apiStatus.baseUrlStatus.valid,
    apiStatus.baseUrlStatus.safeForProduction,
    apiStatus.clientDashboardUrlStatus.valid
  ].filter(Boolean).length;
  const overallReady =
    authStatus.hasSessionSecret &&
    authStatus.sessionSecretStrong &&
    apiStatus.baseUrlStatus.valid &&
    apiStatus.baseUrlStatus.safeForProduction;

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
          <strong>{readyCount}/5</strong>
          <p>Core configuration checks currently passing for the admin console.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Auth Gate</span>
          <strong>
            {authStatus.hasSessionSecret
              ? authStatus.sessionSecretStrong
                ? "Ready"
                : "Weak secret"
              : "Missing env"}
          </strong>
          <p>Controlled by the identity-backed admin login path plus the local session-signing secret.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Gateway API</span>
          <strong>
            {apiStatus.baseUrlStatus.present
              ? apiStatus.baseUrlStatus.valid
                ? apiStatus.baseUrlStatus.safeForProduction
                  ? "Connected"
                  : "Unsafe URL"
                : "Invalid URL"
              : "Missing base URL"}
          </strong>
          <p>Uses the internal admin bearer session to reach bootstrap and provisioning APIs through the gateway.</p>
        </article>
        <article className="stat-card">
          <span className="eyebrow">Deploy Target</span>
          <strong>{vercelReady ? "Vercel-safe" : "Needs production hardening"}</strong>
          <p>The admin console deploys on Vercel, so production base URLs must be HTTPS and the session secret should be strong.</p>
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
              <dd>{authStatus.configured ? "Configured" : "Configuration needed"}</dd>
            </div>
            <div>
              <dt>Gateway base URL</dt>
              <dd>
                {authStatus.apiBaseUrl.present
                  ? authStatus.apiBaseUrl.valid
                    ? authStatus.apiBaseUrl.safeForProduction
                      ? "Present and safe"
                      : "Present but not production-safe"
                    : "Invalid"
                  : "Missing"}
              </dd>
            </div>
            <div>
              <dt>Identity-backed login</dt>
              <dd>{authStatus.apiBaseUrl.valid ? "Enabled" : "Unavailable"}</dd>
            </div>
            <div>
              <dt>Session secret</dt>
              <dd>
                {authStatus.hasSessionSecret
                  ? authStatus.sessionSecretStrong
                    ? "Present and strong"
                    : "Present but weak"
                  : "Missing"}
              </dd>
            </div>
            <div>
              <dt>Cookie signing posture</dt>
              <dd>{authStatus.sessionSecretStrong ? "Appropriate for Vercel deployment" : "Rotate to a longer secret"}</dd>
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
              <dd className="env-value">{apiStatus.baseUrlStatus.value ?? "Missing"}</dd>
            </div>
            <div>
              <dt>Production-safe</dt>
              <dd>{apiStatus.baseUrlStatus.safeForProduction ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>HTTPS</dt>
              <dd>{apiStatus.baseUrlStatus.present ? (apiStatus.baseUrlStatus.https ? "Yes" : "No") : "Missing"}</dd>
            </div>
            <div>
              <dt>Client dashboard URL</dt>
              <dd className="env-value">{apiStatus.clientDashboardUrlStatus.value ?? "Unset"}</dd>
            </div>
            <div>
              <dt>Dashboard URL valid</dt>
              <dd>{apiStatus.clientDashboardUrlStatus.present ? (apiStatus.clientDashboardUrlStatus.valid ? "Yes" : "No") : "Unset"}</dd>
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
            <div className="mini-list-item">
              <span className="step-item-index">4</span>
              <div className="mini-list-copy">
                <strong>Vercel production safety</strong>
                <p>This console is deployed on Vercel, so production API origins and session secrets should be treated as internet-facing configuration, not local-only defaults.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
