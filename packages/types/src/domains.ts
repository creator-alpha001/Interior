/** Service verticals, and what a professional is approved to do in each. */
import type { z } from "zod";
import type {
  domainApprovalStatusSchema,
  domainLabelsSchema,
  domainSchema,
  portfolioItemSchema,
  professionalDomainSchema,
  professionalServiceAreaSchema,
  vendorAchievementKindSchema,
  vendorAchievementSchema,
} from "./schema/domains";

/**
 * A domain is a service vertical (Interior Design, Furniture, Fabrication,
 * Painting, ...). It is a configurable record, never a hardcoded module —
 * adding "Electrical Work" is an admin action, not a release.
 */
export type Domain = z.infer<typeof domainSchema>;

/**
 * The compare-quotes table has identical structure across every domain; only
 * the column captions change. This is what keeps that one component reusable.
 */
export type DomainLabels = z.infer<typeof domainLabelsSchema>;

export type DomainApprovalStatus = z.infer<typeof domainApprovalStatusSchema>;

/**
 * Which domains a vendor is approved to serve. Adding a domain to a vendor's
 * profile is an admin approval, not self-service, so quality is controlled
 * per trade.
 */
export type ProfessionalDomain = z.infer<typeof professionalDomainSchema>;

/** A vendor can serve several cities and localities, not just their own. */
export type ProfessionalServiceArea = z.infer<typeof professionalServiceAreaSchema>;

export type PortfolioItem = z.infer<typeof portfolioItemSchema>;

export type VendorAchievementKind = z.infer<typeof vendorAchievementKindSchema>;

/** An award, certification, membership or press mention, moderated before it is public. */
export type VendorAchievement = z.infer<typeof vendorAchievementSchema>;
