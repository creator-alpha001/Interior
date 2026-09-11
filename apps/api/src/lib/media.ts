/**
 * Turning stored media rows back into the `MediaAsset` shape the views expect.
 *
 * The frontend types carry media inline on their owner; the database keeps it
 * in one table so files have a lifecycle of their own. These functions are the
 * join between the two, and they are the only place that knows how a storage
 * key becomes a URL.
 */
import type { MediaAsset } from "@repo/types";
import { publicUrlFor, readUrlFor } from "./storage";

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
 * One line now, because the driver knows: R2's public base when there is a
 * bucket, this API's own `/media` route when files are on local disk. `ph:`
 * placeholder tokens pass through either way.
 */
export const toPublicUrl = publicUrlFor;

/**
 * A file as a view carries it.
 *
 * `readUrlFor` rather than the public URL, so a private file — a vendor's PAN
 * card, a signed agreement — comes back with a link that expires, from every
 * view that includes it, without each one having to remember.
 */
export function toMediaAsset(row: MediaRow): MediaAsset {
  return {
    id: row.id,
    url: readUrlFor(row.storageKey),
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
