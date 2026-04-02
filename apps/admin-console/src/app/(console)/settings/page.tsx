import { getAdminConsoleAuthStatus } from "@/lib/auth";
import { getInternalApiStatus } from "@/lib/internal-api";

export default function SettingsPage() {
  const authStatus = getAdminConsoleAuthStatus();
  const apiStatus = getInternalApiStatus();

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <span className="eyebrow">Settings</span>
          <h3>Environment readiness</h3>
          <p>These checks make it obvious whether the internal shell can authenticate staff and talk to the provisioning APIs.</p>
        </div>
      </div>

      <div className="detail-grid">
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
              <dt>Allowed emails</dt>
              <dd>{authStatus.allowedEmails.length}</dd>
            </div>
            <div>
              <dt>Platform owners</dt>
              <dd>{authStatus.ownerEmails.length}</dd>
            </div>
            <div>
              <dt>Shared password</dt>
              <dd>{authStatus.hasSharedPassword ? "Present" : "Missing"}</dd>
            </div>
            <div>
              <dt>Session secret</dt>
              <dd>{authStatus.hasSessionSecret ? "Present" : "Missing"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <div className="section-heading">
            <span className="eyebrow">Provisioning API</span>
            <h4>Gateway connection</h4>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Base URL</dt>
              <dd>{apiStatus.baseUrl ?? "Missing"}</dd>
            </div>
            <div>
              <dt>Internal admin token</dt>
              <dd>{apiStatus.hasToken ? "Present" : "Missing"}</dd>
            </div>
            <div>
              <dt>Client dashboard URL</dt>
              <dd>{apiStatus.clientDashboardUrl ?? "Unset"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
