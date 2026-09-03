/**
 * Cursor pagination.
 *
 * The cursor is opaque to the client — `packages/data` passes back whatever it
 * was given and never parses it — so the encoding below can change without a
 * frontend release.
 *
 * It encodes an offset today because the seed-sized dataset does not justify
 * keyset pagination, and because several list endpoints sort by a computed
 * ranking that has no single ordering key. When a list grows past the point
 * where OFFSET hurts, this is the only file that changes.
 */
import type { Paginated } from "@repo/types";

export function encodeCursor(offset: number): string {
  return Buffer.from(`o:${offset}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const offset = Number(decoded.replace(/^o:/, ""));
    // A malformed cursor returns the first page rather than an error: it is
    // usually a stale bookmark, and an error page helps nobody.
    return Number.isFinite(offset) && offset >= 0 ? Math.floor(offset) : 0;
  } catch {
    return 0;
  }
}

/**
 * Builds the response body from a page of rows and the total count.
 *
 * `total` comes from a separate COUNT over the same filters — the frontend
 * shows "3 requirements", filter counts and empty states from it, so it has to
 * describe the whole result set rather than the page.
 */
export function page<T>(items: T[], total: number, offset: number, limit: number): Paginated<T> {
  const next = offset + items.length;
  return {
    items,
    nextCursor: next < total ? encodeCursor(next) : null,
    total,
  };
}
