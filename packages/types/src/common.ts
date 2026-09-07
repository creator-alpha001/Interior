/**
 * Shared primitives used across every entity in the platform.
 *
 * These are derived from the runtime schemas in `./schema`, not restated here.
 * The import below is `import type`, so it is erased entirely at build time —
 * a browser bundle that reaches this file pays nothing for zod, while the types
 * it gets are literally the ones the server validates against.
 */
import type { z } from "zod";
import type {
  baseRecordSchema,
  citySchema,
  mediaAssetSchema,
  paginatedSchema,
} from "./schema/common";

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
export type BaseRecord = z.infer<typeof baseRecordSchema>;

/**
 * Cities are a table, not a free-text string — they drive vendor matching,
 * catalogue pricing and reporting, so "Bengaluru" and "Bangalore" must not
 * be able to diverge.
 */
export type City = z.infer<typeof citySchema>;

/** Uploaded media, referenced by portfolio items, leads, quotes and products. */
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

/**
 * One page of a list, plus what is needed to ask for the next.
 *
 * Every list that grows with the business returns this rather than a bare
 * array. Cursors rather than page numbers because rows are inserted while
 * somebody is paging, and offset paging silently skips or repeats them.
 *
 * Written by hand rather than inferred, because it is generic and `z.infer`
 * cannot carry a type parameter through a factory. `AssertPaginatedMatches`
 * below is what stops that hand-written shape drifting from `paginatedSchema`.
 */
export interface Paginated<T> {
  items: T[];
  /** Opaque. Pass back as `cursor` to get the next page; null on the last. */
  nextCursor: string | null;
  /** Rows matching the filters, ignoring pagination. */
  total: number;
}

/** How many rows a list returns when the caller does not say. */
export const DEFAULT_PAGE_SIZE = 24;

/* ------------------------------------------------------------------ *
 * Drift guards
 *
 * `Paginated<T>` is the one response shape defined twice — once as a generic
 * interface for callers, once as a schema factory for validation. These two
 * lines fail the build if they ever stop describing the same thing.
 * ------------------------------------------------------------------ */

type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

/**
 * Fails to compile unless `T` is exactly `true`.
 *
 * The constraint is the whole mechanism: a conditional type that merely
 * *resolves* to an error object is not an error, it is just a type nobody
 * reads. This one violates `T extends true` and stops the build.
 */
type Assert<T extends true> = T;

export type __PaginatedDriftCheck = Assert<
  Equals<z.infer<ReturnType<typeof paginatedSchema<z.ZodString>>>, Paginated<string>>
>;
