/**
 * The shared design system.
 *
 * Every app in the monorepo — the public site, the internal ops panel and the
 * vendor panel — renders from these primitives, so a change to a button or a
 * badge lands everywhere at once. The design tokens themselves live in each
 * app's globals.css, which is what lets the customer-facing site stay airy
 * while the ops panel runs denser on the same vocabulary.
 */
export { cn } from "./cn";
export { Media } from "./media";
export type { MediaProps } from "./media";
export * from "./primitives";
export * from "./status";
