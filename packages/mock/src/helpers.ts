import type { BaseRecord, MediaAsset, Timestamp } from "@repo/types";

/**
 * Fixed "now" so the seeded data renders identically on every reload and in
 * server/client renders alike. Change this one constant to shift the timeline.
 */
export const NOW = new Date("2026-08-31T10:00:00.000Z");

export function daysAgo(days: number): Timestamp {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

export function daysAhead(days: number): Timestamp {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString();
}

export function dateOnly(iso: Timestamp): string {
  return iso.slice(0, 10);
}

/** Fills the audit columns every record carries. */
export function rec(createdDaysAgo = 120, updatedDaysAgo = 5): BaseRecord {
  return {
    createdAt: daysAgo(createdDaysAgo),
    updatedAt: daysAgo(updatedDaysAgo),
    deletedAt: null,
  };
}

/**
 * Placeholder media token. The `<Media>` component renders a designed gradient
 * tile for `ph:` urls and a real image for anything else — so replacing the
 * whole catalogue with real photography later means changing these strings
 * only, with no component changes.
 */
export function ph(domainSlug: string, seed: string, caption?: string): MediaAsset {
  return {
    id: `media-${domainSlug}-${seed}`,
    url: `ph:${domainSlug}:${seed}`,
    type: "photo",
    caption,
  };
}

export function phSet(domainSlug: string, seed: string, count: number): MediaAsset[] {
  return Array.from({ length: count }, (_, i) => ph(domainSlug, `${seed}-${i + 1}`));
}

/** ₹ formatting used across every surface. */
export function formatRupees(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Compact Indian-style short form: 1,20,000 -> ₹1.2L */
export function formatRupeesShort(amount: number): string {
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2).replace(/\.00$/, "")}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(2).replace(/\.00$/, "")}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `₹${amount}`;
}
