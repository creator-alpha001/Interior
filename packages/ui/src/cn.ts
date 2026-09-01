/** Minimal class combiner — no runtime dependency needed for this. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
