import type { CSSProperties } from "react";

export function NomlyMark({
  className,
  style,
  size = 16,
}: {
  className?: string;
  style?: CSSProperties;
  size?: number;
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        letterSpacing: "-0.025em",
        fontSize: size,
        lineHeight: 1,
        color: "var(--color-text)",
        ...style,
      }}
    >
      nomly
    </span>
  );
}

export function LatteLinkWordmark({
  className,
  style,
  size = 18,
}: {
  className?: string;
  style?: CSSProperties;
  size?: number;
}) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        letterSpacing: "-0.025em",
        fontSize: size,
        lineHeight: 1,
        color: "var(--color-text)",
        ...style,
      }}
    >
      LatteLink
    </span>
  );
}

/** Backwards compatible re-exports for any older imports. */
export const Wordmark = LatteLinkWordmark;
export function LogoIcon() {
  return null;
}
