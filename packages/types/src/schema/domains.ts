import { z } from "zod";
import { baseRecordSchema, idSchema, mediaAssetSchema } from "./common";

/**
 * The compare-quotes table has identical structure across every domain; only
 * the column captions change. This is what keeps that one component reusable.
 */
export const domainLabelsSchema = z.object({
  /** e.g. "Board & Hardware Brand" (Furniture), "Paint Brand & Type" (Painting) */
  materials: z.string(),
  /** e.g. "Material Grade" for Fabrication */
  warranty: z.string(),
  /** How this trade typically prices work, shown next to quote amounts. */
  pricingBasis: z.string(),
});

/**
 * A domain is a service vertical (Interior Design, Furniture, Fabrication,
 * Painting, ...). It is a configurable record, never a hardcoded module —
 * adding "Electrical Work" is an admin action, not a release.
 */
export const domainSchema = baseRecordSchema.extend({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  /** One-line description used on the client home screen. */
  tagline: z.string(),
  description: z.string(),
  iconKey: z.string(),
  bannerUrl: z.string().nullable(),
  defaultCommissionPercent: z.number(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  /** Labels that make one reusable quote/compare UI speak each trade's language. */
  labels: domainLabelsSchema,
});

export const domainApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);

/**
 * Which domains a vendor is approved to serve. Adding a domain to a vendor's
 * profile is an admin approval, not self-service, so quality is controlled
 * per trade.
 */
export const professionalDomainSchema = baseRecordSchema.extend({
  id: idSchema,
  professionalId: idSchema,
  domainId: idSchema,
  verificationStatus: domainApprovalStatusSchema,
  /** Null falls back to Domain.defaultCommissionPercent. */
  commissionPercentOverride: z.number().nullable(),
  /** Ratings are held per domain: the same vendor can be 5* at painting, 4* at carpentry. */
  avgRating: z.number(),
  ratingCount: z.number().int(),
  completedProjects: z.number().int(),
});

/** A vendor can serve several cities and localities, not just their own. */
export const professionalServiceAreaSchema = baseRecordSchema.extend({
  id: idSchema,
  professionalId: idSchema,
  cityId: idSchema,
  /** Optional narrowing inside a city; empty means the whole city. */
  localities: z.array(z.string()),
});

export const portfolioItemSchema = baseRecordSchema.extend({
  id: idSchema,
  professionalId: idSchema,
  domainId: idSchema,
  title: z.string(),
  description: z.string(),
  media: z.array(mediaAssetSchema),
  /** Portfolio media is moderated before it appears on a public profile. */
  moderationStatus: z.enum(["pending", "approved", "rejected"]),
});
