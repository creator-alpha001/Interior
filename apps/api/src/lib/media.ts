/**
 * Turning stored media rows back into the `MediaAsset` shape the views expect.
 *
 * The frontend types carry media inline on their owner; the database keeps it
 * in one table so files have a lifecycle of their own. These functions are the
 * join between the two, and they are the only place that knows how a storage
 * key becomes a URL.
 */
import type { MediaAsset } from "@repo/types";
import { config } from "./config";

export interface MediaRow {
  id: string;
  type: "photo" | "video" | "document";
  storageKey: string;
  caption: string | null;
  ownerType: string | null;
  ownerId: string | null;
  sortOrder: number;
}

/**
 * Where a stored file is readable from.
 *
 * `ph:` keys are placeholder tokens, not files — the seed data uses them and the
 * `Media` component renders them as designed tiles rather than fetching
 * anything. They pass through untouched so the demo keeps its imagery; real
 * keys are resolved against the bucket's public base.
 */
export function toPublicUrl(storageKey: string): string {
  if (storageKey.startsWith("ph:") || storageKey.startsWith("http")) return storageKey;

  const base = config.R2_PUBLIC_BASE_URL;
  if (!base) return storageKey;

  return `${base.replace(/\/$/, "")}/${storageKey.replace(/^\//, "")}`;
}

export function toMediaAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    url: toPublicUrl(row.storageKey),
    type: row.type,
    ...(row.caption ? { caption: row.caption } : {}),
  };
}

/**
 * Groups media rows by the record they belong to.
 *
 * Callers fetch a page of products and then every asset for that page in one
 * query, rather than one query per product — the difference between two round
 * trips and twenty-five.
 */
export function groupMediaByOwner(rows: MediaRow[]): Map<string, MediaAsset[]> {
  const byOwner = new Map<string, MediaAsset[]>();

  for (const row of rows) {
    if (!row.ownerId) continue;
    const existing = byOwner.get(row.ownerId);
    if (existing) existing.push(toMediaAsset(row));
    else byOwner.set(row.ownerId, [toMediaAsset(row)]);
  }

  return byOwner;
}
