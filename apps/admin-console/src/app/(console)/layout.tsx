import { signOutAction } from "@/app/actions";
import { SidebarNav } from "@/components/SidebarNav";
import { getAdminConsoleAuthStatus, requireAdminSession } from "@/lib/auth";
import { getInternalApiStatus } from "@/lib/internal-api";

function getUserInitials(email: string) {
  const localPart = email.split("@")[0] ?? email;
  return localPart
    .split(/[.\-_]/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

function formatAdminRole(role: string) {
  switch (role) {
    case "platform_owner":
      return "Platform Owner";
    case "platform_operator":
      return "Platform Operator";
    case "support_readonly":
      return "Support Read Only";
    default:
      return role;
  }
}

export default async function ConsoleLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdminSession();
  const authStatus = getAdminConsoleAuthStatus();
  const apiStatus = getInternalApiStatus();
  const ready = authStatus.hasSessionSecret && apiStatus.hasBaseUrl;
  const initials = getUserInitials(session.admin.email);

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="sidebar-brand">
          <span className="eyebrow">LatteLink</span>
          <h1>Internal Console</h1>
          <p>Admin control plane for dashboard launches, client onboarding, and platform configuration.</p>
        </div>
        <SidebarNav />
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span>{session.admin.email}</span>
            <strong>{formatAdminRole(session.admin.role)}</strong>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="ghost-button">
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <div className="console-main">
        <header className="console-topbar">
          <div className={ready ? "topbar-status is-success" : "topbar-status is-warning"}>
            {ready ? "Environment ready" : "Configuration needed"}
          </div>
          <div className="topbar-user">
            <div className="topbar-user-copy">
              <strong>{formatAdminRole(session.admin.role)}</strong>
              <span>{session.admin.email}</span>
            </div>
            <div className="topbar-avatar" aria-hidden="true">
              {initials || "LL"}
            </div>
          </div>
        </header>
        <main className="console-content">{children}</main>
      </div>
    </div>
  );
}
