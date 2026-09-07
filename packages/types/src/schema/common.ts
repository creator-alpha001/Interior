/**
 * Shared primitives, as runtime schemas.
 *
 * This directory is the single source of truth for every response shape on the
 * platform. The sibling files one level up (`../common.ts`, `../views.ts`, ...)
 * do not restate these shapes — they `import type` from here and hand the result
 * to `z.infer`, so a schema and its TypeScript type cannot drift apart. There is
 * no second definition to keep in step.
 *
 * Nothing outside this directory imports it for its *value* unless it genuinely
 * needs runtime validation. `@repo/types` resolves to the type-only entry point;
 * `@repo/types/schema` is this. That split is what keeps zod out of the browser
 * bundle while still deriving the browser's types from it.
 */
import { z } from "zod";

/** A primary key. Uuid-shaped everywhere the database issues it. */
export const idSchema = z.string();

/** ISO-8601 timestamp, e.g. "2026-08-31T10:15:00.000Z" */
export const timestampSchema = z.string();

/** ISO date without time, e.g. "2026-08-31" */
export const dateOnlySchema = z.string();

/**
 * Amounts are whole rupees (INR). No paise anywhere on the platform.
 *
 * `.int()` is load-bearing, and not for TypeScript — it infers `number` either
 * way. It is what makes the JSON Schema say `"type": "integer"` rather than
 * `"number"`, which is what makes the generated Dart say `int` rather than
 * `num`. MOBILE.md §4.3: *"`Rupees` is an `int`. Make it a Dart `int`, never a
 * `double`. Money in a floating-point type is how ₹1 goes missing."*
 *
 * Without it the mobile models typed every amount `num`, and the test meant to
 * catch that passed anyway — `expect(rate, isA<int>())` inspects the runtime
 * value, and `12500` parsed from JSON is an `int` whatever the static type says.
 */
export const rupeesSchema = z.number().int();

/**
 * Every persisted record carries these. `deletedAt` is a soft delete:
 * nothing is hard-deleted, so support can always reconstruct history.
 */
export const baseRecordSchema = z.object({
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  deletedAt: timestampSchema.nullable(),
});

/**
 * Cities are a table, not a free-text string — they drive vendor matching,
 * catalogue pricing and reporting, so "Bengaluru" and "Bangalore" must not
 * be able to diverge.
 */
export const citySchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  state: z.string(),
  isActive: z.boolean(),
});

/** Uploaded media, referenced by portfolio items, leads, quotes and products. */
export const mediaAssetSchema = z.object({
  id: idSchema,
  url: z.string(),
  type: z.enum(["photo", "video", "document"]),
  caption: z.string().optional(),
});

/**
 * One page of a list, plus what is needed to ask for the next.
 *
 * A factory rather than a fixed schema, because the item type varies. The
 * generic `Paginated<T>` in `../common.ts` is asserted against this at compile
 * time, so the two cannot drift even though only one of them is inferred.
 */
export const paginatedSchema = <Item extends z.ZodTypeAny>(item: Item) =>
  z.object({
    items: z.array(item),
    /** Opaque. Pass back as `cursor` to get the next page; null on the last. */
    nextCursor: z.string().nullable(),
    /** Rows matching the filters, ignoring pagination. */
    total: z.number(),
  });
