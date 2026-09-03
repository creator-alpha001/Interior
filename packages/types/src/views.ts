/**
 * View models: the joined, denormalised shapes the UI actually renders.
 *
 * Screens never assemble joins themselves — the data layer returns these, so
 * when the mock adapter is swapped for real HTTP endpoints the components do
 * not change. Keep these aligned with what a single API response should carry.
 */
import type { City, ID, Rupees } from "./common";
import type { Agreement, AgreementLeadDomain } from "./agreements";
import type { CommissionInvoice, Project, Review } from "./execution";
import type { Domain, PortfolioItem, ProfessionalDomain } from "./domains";
import type { Lead, LeadDomain, LeadDomainAssignment, LeadDomainItem } from "./leads";
import type { Meeting, Quote } from "./flow";
import type { Product, ProductCategory, ServicePackage } from "./catalog";
import type { BlogCategory, BlogPost } from "./content";
import type { Client, Professional, User } from "./identity";

export interface ProfessionalSummary {
  id: ID;
  name: string;
  companyName: string;
  avatarUrl: string | null;
  city: City;
  experienceYears: number;
  completedProjects: number;
  avgRating: number;
  ratingCount: number;
  languages: string[];
  isVerified: boolean;
  avgResponseHours: number;
  domains: Domain[];
  /** Per-domain rating, when viewing this vendor in the context of one domain. */
  domainRating?: { domainId: ID; avgRating: number; ratingCount: number };
}

export interface ProfessionalProfile extends ProfessionalSummary {
  professional: Professional;
  user: User;
  bio: string;
  domainStats: ProfessionalDomain[];
  serviceCities: City[];
  portfolio: PortfolioItem[];
  reviews: ReviewView[];
}

export interface ReviewView {
  review: Review;
  clientName: string;
  domain: Domain;
  projectTitle: string;
}

export interface ClientSummary {
  id: ID;
  userId: ID;
  name: string;
  mobile: string;
  email: string | null;
  city: City;
  address: string | null;
}

/**
 * What a vendor is allowed to see about a client.
 *
 * Contact details are never exposed to the vendor panel. The locality is
 * released so they can judge travel and price the job; the full address is
 * released only for a confirmed site visit, and the mobile number is never
 * released at all — the platform coordinates every conversation.
 */
export interface MaskedClientSummary {
  /** First name plus initial, e.g. "Priya S." */
  displayName: string;
  city: City;
  locality: string;
  /** Full address, present only once a visit has been confirmed. */
  address: string | null;
  contactReleased: false;
}

/** One service track inside a requirement, with everything hanging off it. */
export interface LeadDomainView {
  leadDomain: LeadDomain;
  domain: Domain;
  assignments: Array<{
    assignment: LeadDomainAssignment;
    professional: ProfessionalSummary;
  }>;
  quotes: QuoteView[];
  meetings: Array<{ meeting: Meeting; professional: ProfessionalSummary }>;
  items: LeadDomainItem[];
  selectedProfessional: ProfessionalSummary | null;
  /** Unread messages in the client's thread with the platform. */
  unreadMessages: number;
}

export interface LeadView {
  lead: Lead;
  client: ClientSummary;
  city: City;
  domains: LeadDomainView[];
  /** Convenience flags for list screens. */
  domainNames: string[];
  isMultiDomain: boolean;
}

export interface QuoteView {
  quote: Quote;
  professional: ProfessionalSummary;
  domain: Domain;
}

export interface AgreementView {
  agreement: Agreement;
  professional: ProfessionalSummary;
  client: ClientSummary;
  lines: Array<{
    link: AgreementLeadDomain;
    domain: Domain;
    quote: Quote;
  }>;
  /** True when one professional covers several domains under one contract. */
  isCombined: boolean;
  projects: ProjectView[];
  invoice: CommissionInvoice | null;
}

export interface ProjectView {
  project: Project;
  domain: Domain;
  professional: ProfessionalSummary;
  client: ClientSummary;
  review: Review | null;
}

export interface ProductView {
  product: Product;
  domain: Domain;
  category: ProductCategory;
  /** Price after city override, when a city is in context. */
  effectivePrice: Rupees;
}

export interface PackageView {
  servicePackage: ServicePackage;
  domain: Domain;
  items: Array<{ label: string; quantity: number; productId: ID | null }>;
}

export interface BlogPostView {
  post: BlogPost;
  category: BlogCategory;
  tags: string[];
  domain: Domain | null;
}

/** Everything one search box query can turn up, ranked by intent. */
export interface SearchResults {
  query: string;
  total: number;
  products: ProductView[];
  packages: PackageView[];
  professionals: ProfessionalSummary[];
  posts: BlogPostView[];
}

export interface ClientRecord {
  client: Client;
  user: User;
}

/* ------------------------------------------------------------------ *
 * The vendor portal
 *
 * These shapes exist to be *incapable* of carrying a customer's contact
 * details. Everywhere a client appears it is a `MaskedClientSummary`, which has
 * no field for a phone number or an email — so a leak would have to be a
 * deliberate change to the type, not an oversight in a query.
 * ------------------------------------------------------------------ */

/** One lead offered to one vendor. */
export interface VendorLeadCard {
  assignment: LeadDomainAssignment;
  leadDomain: LeadDomain;
  domain: Domain;
  leadReference: string;
  client: MaskedClientSummary;
  /** The client's own description of the job. */
  description: string;
  urgency: string;
  materialSource: LeadDomain["materialSource"];
  items: LeadDomainItem[];
  /** The brief our team captured on the call — the real scope. */
  brief: string | null;
  siteNotes: string[];
  budgetMax: Rupees | null;
  myQuote: Quote | null;
  visits: Meeting[];
  unreadMessages: number;
  /**
   * How many others are quoting. Stated plainly so nobody assumes the job is
   * theirs.
   */
  competingQuotes: number;
  /**
   * Decided server-side. A screen comparing `selectedProfessionalId` against a
   * hardcoded "who am I" is a bug waiting for the day that value is wrong.
   */
  won: boolean;
  lost: boolean;
}

export interface VendorDashboard {
  professional: Professional;
  displayName: string;
  domains: Array<{ link: ProfessionalDomain; domain: Domain }>;
  newLeads: number;
  awaitingQuote: number;
  quotesOut: number;
  wonThisPeriod: number;
  liveProjects: number;
  visitsToday: number;
  commissionDue: Rupees;
  commissionOverdue: Rupees;
  unreadMessages: number;
}

export interface VendorAgreementView {
  agreement: Agreement;
  client: MaskedClientSummary;
  lines: Array<{ link: AgreementLeadDomain; domain: Domain; quote: Quote }>;
  isCombined: boolean;
  projects: Array<{ project: Project; domain: Domain }>;
  invoice: CommissionInvoice | null;
}

export interface VendorProjectView {
  project: Project;
  domain: Domain;
  client: MaskedClientSummary;
  cityName: string;
  review: Review | null;
}

export interface VendorPerformance {
  byDomain: Array<{
    domain: Domain;
    rating: number;
    ratingCount: number;
    completed: number;
    won: number;
    lost: number;
    winRatePercent: number;
    commissionPercent: number;
  }>;
  avgResponseHours: number;
  totalRevenue: Rupees;
  reviews: Array<{ review: Review; domain: Domain; clientName: string }>;
}

export interface VendorInvoiceView {
  invoice: CommissionInvoice;
  agreementReference: string;
  domains: string[];
}

export interface VendorVisitView {
  meeting: Meeting;
  domain: Domain;
  client: MaskedClientSummary;
  leadReference: string;
}
