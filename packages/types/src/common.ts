/** Shared primitives used across every entity in the platform. */

export type ID = string;

/** ISO-8601 timestamp, e.g. "2026-08-31T10:15:00.000Z" */
export type Timestamp = string;

/** ISO date without time, e.g. "2026-08-31" */
export type DateOnly = string;

/** Amounts are stored in whole rupees (INR). No paise anywhere on the platform. */
export type Rupees = number;

/**
 * Every persisted record carries these. `deletedAt` is a soft delete:
 * nothing is hard-deleted, so support can always reconstruct history.
 */
export interface BaseRecord {
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
}

/**
 * Cities are a table, not a free-text string — they drive vendor matching,
 * catalogue pricing and reporting, so "Bengaluru" and "Bangalore" must not
 * be able to diverge.
 */
export interface City {
  id: ID;
  name: string;
  slug: string;
  state: string;
  isActive: boolean;
}

/** Uploaded media, referenced by portfolio items, leads, quotes and products. */
export interface MediaAsset {
  id: ID;
  url: string;
  type: "photo" | "video" | "document";
  caption?: string;
}
