import { signOutAction } from "@/app/actions";
import { SidebarNav } from "@/components/SidebarNav";
import { requireAdminSession } from "@/lib/auth";

export default async function ConsoleLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireAdminSession();

  return (
    <div className="console-shell">
      <aside className="console-sidebar">
        <div className="sidebar-brand">
          <span className="eyebrow">LatteLink</span>
          <h1>Admin Console</h1>
          <p>Pilot client onboarding and launch control.</p>
        </div>
        <SidebarNav />
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span>{session.email}</span>
            <strong>{session.role === "platform_owner" ? "Platform Owner" : "Platform Operator"}</strong>
          </div>
          <form action={signOutAction}>
            <button type="submit" className="ghost-button">
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      <div className="console-main">
        <header className="console-header">
          <div>
            <span className="eyebrow">Internal Control Plane</span>
            <h2>Provision stores, hand off access, and keep pilot launches disciplined.</h2>
          </div>
        </header>
        <main className="console-content">{children}</main>
      </div>
    </div>
  );
}
