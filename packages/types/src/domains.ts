import type { BaseRecord, ID, MediaAsset } from "./common";

/**
 * A domain is a service vertical (Interior Design, Furniture, Fabrication,
 * Painting, ...). It is a configurable record, never a hardcoded module —
 * adding "Electrical Work" is an admin action, not a release.
 */
export interface Domain extends BaseRecord {
  id: ID;
  name: string;
  slug: string;
  /** One-line description used on the client home screen. */
  tagline: string;
  description: string;
  iconKey: string;
  bannerUrl: string | null;
  defaultCommissionPercent: number;
  isActive: boolean;
  sortOrder: number;
  /** Labels that make one reusable quote/compare UI speak each trade's language. */
  labels: DomainLabels;
}

/**
 * The compare-quotes table has identical structure across every domain; only
 * the column captions change. This is what keeps that one component reusable.
 */
export interface DomainLabels {
  /** e.g. "Board & Hardware Brand" (Furniture), "Paint Brand & Type" (Painting) */
  materials: string;
  /** e.g. "Material Grade" for Fabrication */
  warranty: string;
  /** How this trade typically prices work, shown next to quote amounts. */
  pricingBasis: string;
}

export type DomainApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Which domains a vendor is approved to serve. Adding a domain to a vendor's
 * profile is an admin approval, not self-service, so quality is controlled
 * per trade.
 */
export interface ProfessionalDomain extends BaseRecord {
  id: ID;
  professionalId: ID;
  domainId: ID;
  verificationStatus: DomainApprovalStatus;
  /** Null falls back to Domain.defaultCommissionPercent. */
  commissionPercentOverride: number | null;
  /** Ratings are held per domain: the same vendor can be 5* at painting, 4* at carpentry. */
  avgRating: number;
  ratingCount: number;
  completedProjects: number;
}

/** A vendor can serve several cities and localities, not just their own. */
export interface ProfessionalServiceArea extends BaseRecord {
  id: ID;
  professionalId: ID;
  cityId: ID;
  /** Optional narrowing inside a city; empty means the whole city. */
  localities: string[];
}

export interface PortfolioItem extends BaseRecord {
  id: ID;
  professionalId: ID;
  domainId: ID;
  title: string;
  description: string;
  media: MediaAsset[];
  /** Portfolio media is moderated before it appears on a public profile. */
  moderationStatus: "pending" | "approved" | "rejected";
}
