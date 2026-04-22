import type { CSSProperties, ReactNode } from "react";

export function Section({
  id,
  children,
  className,
  style,
  variant = "default",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: "default" | "muted" | "invert";
}) {
  const palette: Record<string, CSSProperties> = {
    default: { background: "var(--color-bg)", color: "var(--color-text)" },
    muted: { background: "var(--color-bg-muted)", color: "var(--color-text)" },
    invert: {
      background: "var(--color-bg-invert)",
      color: "var(--color-text-invert)",
    },
  };

  return (
    <section
      id={id}
      className={className}
      style={{
        paddingBlock: 128,
        ...palette[variant],
        ...style,
      }}
    >
      <div className="page-shell">{children}</div>
    </section>
  );
}

export function Eyebrow({
  children,
  invert = false,
}: {
  children: ReactNode;
  invert?: boolean;
}) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: invert ? "var(--color-text-invert-muted)" : "var(--color-text-muted)",
        marginBottom: 20,
      }}
    >
      {children}
    </div>
  );
}

export function Heading({
  children,
  level = 2,
  invert = false,
  style,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3;
  invert?: boolean;
  style?: CSSProperties;
}) {
  const sizes: Record<1 | 2 | 3, string> = {
    1: "clamp(40px, 6.4vw, 76px)",
    2: "clamp(30px, 4vw, 48px)",
    3: "clamp(22px, 2.4vw, 28px)",
  };
  const Tag = (`h${level}` as unknown) as "h1" | "h2" | "h3";
  return (
    <Tag
      style={{
        fontSize: sizes[level],
        fontWeight: 600,
        letterSpacing: level === 1 ? "-0.04em" : "-0.03em",
        lineHeight: level === 1 ? 1.02 : 1.1,
        color: invert ? "var(--color-text-invert)" : "var(--color-text)",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export function Lead({
  children,
  invert = false,
  maxWidth = 620,
  style,
}: {
  children: ReactNode;
  invert?: boolean;
  maxWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: 18,
        lineHeight: 1.6,
        color: invert ? "var(--color-text-invert-muted)" : "var(--color-text-muted)",
        maxWidth,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function Body({
  children,
  invert = false,
  style,
}: {
  children: ReactNode;
  invert?: boolean;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        fontSize: 15,
        lineHeight: 1.65,
        color: invert ? "var(--color-text-invert-muted)" : "var(--color-text-muted)",
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lead,
  invert = false,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  invert?: boolean;
  align?: "left" | "center";
}) {
  return (
    <div
      style={{
        textAlign: align,
        maxWidth: 760,
        marginInline: align === "center" ? "auto" : undefined,
        marginBottom: 64,
      }}
    >
      {eyebrow && <Eyebrow invert={invert}>{eyebrow}</Eyebrow>}
      <Heading level={2} invert={invert}>
        {title}
      </Heading>
      {lead && (
        <div style={{ marginTop: 20 }}>
          <Lead
            invert={invert}
            maxWidth={760}
            style={{ marginInline: align === "center" ? "auto" : undefined }}
          >
            {lead}
          </Lead>
        </div>
      )}
    </div>
  );
}

const buttonBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  height: 42,
  paddingInline: 18,
  borderRadius: "var(--radius-md)",
  border: "1px solid transparent",
  textDecoration: "none",
  transition:
    "background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export function buttonStyles(
  variant: "primary" | "secondary" | "ghost" | "invert-primary" | "invert-secondary" = "primary",
): CSSProperties {
  switch (variant) {
    case "primary":
      return {
        ...buttonBase,
        background: "var(--color-text)",
        color: "var(--color-text-invert)",
        borderColor: "var(--color-text)",
      };
    case "secondary":
      return {
        ...buttonBase,
        background: "var(--color-bg)",
        color: "var(--color-text)",
        borderColor: "var(--color-border-strong)",
      };
    case "ghost":
      return {
        ...buttonBase,
        background: "transparent",
        color: "var(--color-text)",
      };
    case "invert-primary":
      return {
        ...buttonBase,
        background: "var(--color-text-invert)",
        color: "var(--color-text)",
        borderColor: "var(--color-text-invert)",
      };
    case "invert-secondary":
      return {
        ...buttonBase,
        background: "transparent",
        color: "var(--color-text-invert)",
        borderColor: "rgba(255,255,255,0.25)",
      };
  }
}
