"use client";

import { Section, SectionHeader } from "./Sections";
import { AnimateIn, Stagger, StaggerItem } from "./AnimateIn";

const features = [
  {
    title: "Branded mobile app",
    desc: "A polished iOS app under your shop's name and brand — not a marketplace listing buried among competitors.",
  },
  {
    title: "Mobile ordering",
    desc: "Repeat ordering, scheduling, and pickup flows tuned for the way coffee shops actually run service.",
  },
  {
    title: "Loyalty & rewards",
    desc: "Points, tiers, and recurring offers configured for your menu — not generic punch-card mechanics.",
  },
  {
    title: "Customer ownership",
    desc: "Every order builds a direct customer relationship that lives in your dashboard, not on a third-party platform.",
  },
  {
    title: "Operator dashboard",
    desc: "Menus, hours, pricing, loyalty, and customer activity all editable in one clean operator console.",
  },
  {
    title: "Flat pricing",
    desc: "A predictable monthly subscription. No platform percentage on each cup, no surprise volume penalty.",
  },
];

export function ProductOverview() {
  return (
    <Section id="product">
      <SectionHeader
        eyebrow="Product"
        title="Everything a coffee shop needs to own its mobile experience."
        lead="LatteLink replaces the patchwork of marketplace apps, generic loyalty plug-ins, and DIY tooling with one product designed for independent shops."
      />

      <Stagger
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 1,
          background: "var(--color-border)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
        className="product-grid"
      >
        {features.map((f) => (
          <StaggerItem key={f.title} style={{ background: "var(--color-bg)" }}>
            <div style={{ padding: "32px 28px", height: "100%" }}>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  marginBottom: 10,
                }}
              >
                {f.title}
              </div>
              <div
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: "var(--color-text-muted)",
                }}
              >
                {f.desc}
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <AnimateIn>
        <div
          style={{
            marginTop: 40,
            fontSize: 13,
            color: "var(--color-text-subtle)",
            textAlign: "center",
          }}
        >
          Coffee-only by design. No multi-vertical compromises.
        </div>
      </AnimateIn>

      <style jsx>{`
        :global(.product-grid) {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        @media (max-width: 900px) {
          :global(.product-grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 600px) {
          :global(.product-grid) {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Section>
  );
}
