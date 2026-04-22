"use client";

import { motion } from "framer-motion";
import { demoHref } from "@/lib/site";
import { TrackedAnchor } from "./TrackedAnchor";
import { buttonStyles } from "./Sections";

const ease = [0.16, 1, 0.3, 1] as const;

export function Hero() {
  return (
    <section
      style={{
        paddingTop: 120,
        paddingBottom: 120,
        background: "var(--color-bg)",
      }}
    >
      <div
        className="page-shell"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)",
            background: "var(--color-bg-muted)",
            borderRadius: 999,
            padding: "6px 12px",
            marginBottom: 32,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--color-text)",
            }}
          />
          LatteLink by Nomly
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.05 }}
          style={{
            fontSize: "clamp(40px, 6.4vw, 76px)",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            lineHeight: 1.02,
            margin: 0,
            maxWidth: 880,
          }}
        >
          Mobile ordering for modern coffee shops.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease, delay: 0.15 }}
          style={{
            marginTop: 28,
            maxWidth: 620,
            fontSize: 19,
            lineHeight: 1.55,
            color: "var(--color-text-muted)",
          }}
        >
          LatteLink by Nomly helps independent coffee shops launch a polished
          mobile ordering app, loyalty program, and customer experience —
          without giving up margin to a marketplace.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease, delay: 0.25 }}
          style={{
            marginTop: 40,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "center",
          }}
        >
          <TrackedAnchor
            href={demoHref}
            style={buttonStyles("primary")}
            eventName="cta_click"
            eventProperties={{
              placement: "hero",
              label: "request_access",
              destination: "contact",
            }}
          >
            Request access
          </TrackedAnchor>
          <TrackedAnchor
            href="#product"
            style={buttonStyles("secondary")}
            eventName="cta_click"
            eventProperties={{
              placement: "hero",
              label: "see_product",
              destination: "product",
            }}
          >
            See the product
          </TrackedAnchor>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease, delay: 0.4 }}
          style={{
            marginTop: 64,
            fontSize: 13,
            color: "var(--color-text-subtle)",
            letterSpacing: "0.02em",
          }}
        >
          Built for independent coffee shops &middot; Currently in pilot
        </motion.div>
      </div>
    </section>
  );
}
