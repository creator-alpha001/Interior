/**
 * Input schemas shared across modules.
 *
 * These are the runtime half of `@repo/types`: that package says what a shape
 * is, this one checks that something actually is that shape. Every value
 * arriving from a browser passes through one of these before the server acts
 * on it.
 */
import { z } from "zod";
import { DEFAULT_PAGE_SIZE } from "@repo/types";

/** A UUID primary key. */
export const idSchema = z.string().uuid();

/** A slug in a URL path. Bounded so a pathological value cannot reach the database. */
export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Not a valid slug");

/**
 * Indian mobile number, normalised to twelve digits with the country code.
 *
 * Accepts what people actually type — "+91 99193 44871", "099193 44871",
 * "9919344871" — and stores one form. The alternative is three rows for one
 * person and a login that works on Tuesday but not Wednesday.
 */
export const mobileSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .transform((value) => value.replace(/^\+/, ""))
  .transform((value) => (value.length === 11 && value.startsWith("0") ? value.slice(1) : value))
  .transform((value) => (value.length === 10 ? `91${value}` : value))
  .refine((value) => /^91[6-9]\d{9}$/.test(value), "Not a valid Indian mobile number");

/** Whole rupees. No paise anywhere on this platform. */
export const rupeesSchema = z.number().int().min(0).max(1_000_000_000);

/** Cursor pagination. The cursor is opaque and passed back unread. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(DEFAULT_PAGE_SIZE),
  cursor: z.string().max(4096).optional(),
});

/**
 * Free text a person typed, bounded.
 *
 * Length caps are not decoration: an unbounded text field is an easy way to
 * push a database over on a shared plan.
 */
export const shortText = (max = 200) => z.string().trim().min(1).max(max);
export const longText = (max = 5000) => z.string().trim().min(1).max(max);
export const optionalText = (max = 2000) => z.string().trim().max(max).nullish();

/** A media asset id returned by the upload ticket flow. */
export const mediaIdSchema = z.string().uuid();

/**
 * A comma-separated query parameter, e.g. `?tags=bestseller,new`.
 *
 * Repeated keys would be more conventional, but the frontend already builds
 * these as comma-joined strings in `listProducts`.
 */
export const csvSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value.split(",").map((part) => part.trim()).filter(Boolean) : undefined));

/** Coerces "true"/"false" query strings, which arrive as text. */
export const boolQuerySchema = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform((value) => (typeof value === "string" ? value === "true" : value));
