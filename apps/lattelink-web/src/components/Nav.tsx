"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoIcon, Wordmark } from "./Logo";
import { demoHref } from "@/lib/site";
import { TrackedAnchor } from "./TrackedAnchor";

const links = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#about", label: "About" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const total =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? window.scrollY / total : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Scroll progress */}
      <div
        className="progress-bar"
        style={{ transform: `scaleX(${progress})` }}
      />

      <nav
        className="site-nav"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          borderBottom: `1px solid ${scrolled ? "var(--color-border-s)" : "transparent"}`,
          backdropFilter: scrolled ? "blur(24px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(24px)" : "none",
          background: scrolled ? "rgba(9,9,15,0.85)" : "transparent",
          transition: "background 0.4s, border-color 0.4s",
        }}
      >
        <div className="page-shell nav-shell">
          {/* Logo */}
          <Link
            href="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
            }}
          >
            <LogoIcon size={34} />
            <Wordmark style={{ fontSize: 17, color: "var(--color-gray-100)" }} />
          </Link>

          {/* Links */}
          <ul className="nav-links">
            {links.map((l) => (
              <li key={l.href}>
                <NavLink href={l.href}>{l.label}</NavLink>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <TrackedAnchor
            href={demoHref}
            className="btn-primary-nav nav-cta"
            eventName="cta_click"
            eventProperties={{ placement: "nav", label: "request_intro", destination: "contact" }}
          >
            Request intro
          </TrackedAnchor>
        </div>
      </nav>

      <style>{`
        .nav-shell {
          height: 68px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 36px;
          list-style: none;
        }
        .btn-primary-nav {
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, #2a5fff, #4a7eff);
          border: none;
          border-radius: 8px;
          padding: 10px 22px;
          text-decoration: none;
          box-shadow: 0 0 20px rgba(74,126,255,0.3);
          transition: opacity 0.2s, box-shadow 0.2s, transform 0.2s;
        }
        .btn-primary-nav:hover {
          opacity: 0.9;
          box-shadow: 0 0 36px rgba(74,126,255,0.5);
          transform: translateY(-1px);
        }
        .nav-link-item {
          color: var(--color-gray-400);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          position: relative;
          transition: color 0.2s;
        }
        .nav-link-item::after {
          content: '';
          position: absolute;
          bottom: -4px; left: 0; right: 0;
          height: 1px;
          background: var(--color-blue-500);
          transform: scaleX(0);
          transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        .nav-link-item:hover { color: var(--color-gray-100); }
        .nav-link-item:hover::after { transform: scaleX(1); }
        @media (max-width: 920px) {
          .nav-links {
            display: none;
          }
          .nav-shell {
            gap: 12px;
          }
        }
        @media (max-width: 640px) {
          .nav-shell {
            height: 62px;
          }
          .btn-primary-nav {
            padding: 9px 14px;
            font-size: 13px;
          }
        }
      `}</style>
    </>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <TrackedAnchor
      href={href}
      className="nav-link-item"
      eventName="section_navigation_click"
      eventProperties={{ placement: "nav", destination: href }}
    >
      {children}
    </TrackedAnchor>
  );
}
