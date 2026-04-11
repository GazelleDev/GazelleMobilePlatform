"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/clients/new", label: "New Client" },
  { href: "/launch-readiness", label: "Launch Readiness" },
  { href: "/settings", label: "Settings" }
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="Admin Console">
      {navItems.map((item) => {
        const active = pathname === item.href || (item.href !== "/clients/new" && pathname.startsWith(`${item.href}/`));
        return (
          <Link key={item.href} href={item.href} className={active ? "sidebar-link is-active" : "sidebar-link"}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
