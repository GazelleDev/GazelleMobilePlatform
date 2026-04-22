"use client";

import { Section, SectionHeader } from "./Sections";
import { AnimateIn, Stagger, StaggerItem } from "./AnimateIn";

const steps = [
  {
    num: "01",
    title: "Request a pilot intro",
    desc: "Tell us how your shop runs today and how customers order. We confirm fit before scheduling a walkthrough — no pitch deck, no canned funnel.",
  },
  {
    num: "02",
    title: "We configure your launch",
    desc: "We set up your brand, menu, loyalty rules, and operator dashboard. You review and approve, and we handle the technical heavy lifting.",
  },
  {
    num: "03",
    title: "Launch under your brand",
    desc: "Your app ships under your name. We guide the App Store submission and launch instead of handing you a list of vendor tasks.",
  },
  {
    num: "04",
    title: "Operate and iterate",
    desc: "Orders, loyalty activity, and customer data flow into one console so you can keep improving the experience over time.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how" variant="muted">
      <SectionHeader
        eyebrow="How it works"
        title="From intro request to pilot launch — without the integrator overhead."
        lead="LatteLink is intentionally hands-on. You do not need to manage a stack of contractors, software vendors, or App Store paperwork."
      />

      <Stagger
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 24,
        }}
        className="how-grid"
      >
        {steps.map((s) => (
          <StaggerItem key={s.num}>
            <div style={{ height: "100%" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.16em",
                  color: "var(--color-text-subtle)",
                  marginBottom: 16,
                }}
              >
                {s.num}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  marginBottom: 10,
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: "var(--color-text-muted)",
                }}
              >
                {s.desc}
              </div>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <AnimateIn>
        <div
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid var(--color-border)",
            fontSize: 14,
            color: "var(--color-text-muted)",
          }}
        >
          Most pilot shops are live within a few weeks of the first walkthrough.
        </div>
      </AnimateIn>

      <style jsx>{`
        @media (max-width: 980px) {
          :global(.how-grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 560px) {
          :global(.how-grid) {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Section>
  );
}
