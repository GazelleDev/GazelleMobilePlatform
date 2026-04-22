/**
 * Backwards-compatibility shim. The marketing site's About / CTA / Footer
 * sections were split into dedicated files (WhyItMatters, Contact, Footer)
 * during the Nomly refresh. The legal pages (/privacy-policy, /terms) still
 * import { Footer } from "@/components/About", so we re-export it here.
 */
export { Footer } from "./Footer";
export { WhyItMatters as About } from "./WhyItMatters";
export { Contact as CTA } from "./Contact";
