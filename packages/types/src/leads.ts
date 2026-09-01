import type { BaseRecord, DateOnly, ID, MediaAsset, Rupees } from "./common";

export type Urgency = "immediate" | "within_month" | "exploring";

export type SiteAccessibilityTag =
  | "parking"
  | "lift"
  | "timing_restriction"
  | "other";

export type LeadSource = "app" | "website" | "referral" | "sales_call" | "catalogue";

/**
 * Derived from the lead's LeadDomain rows, never set directly:
 * - new        : no domain verified yet
 * - verified   : admin has validated the lead, assignment not started
 * - in_progress: at least one domain is past pending_assignment
 * - closed     : every domain is completed or cancelled
 * - archived   : manually archived by admin
 */
export type LeadStatus = "new" | "verified" | "in_progress" | "closed" | "archived";

/** One row per requirement submission, whatever number of services it spans. */
export interface Lead extends BaseRecord {
  id: ID;
  reference: string;
  clientId: ID;
  cityId: ID;
  /** The customer's own words. Detailed scoping happens on the sales call. */
  description: string;
  urgency: Urgency;
  budgetMin: Rupees | null;
  budgetMax: Rupees | null;
  siteAccessibilityTags: SiteAccessibilityTag[];
  photos: MediaAsset[];
  source: LeadSource;
  overallStatus: LeadStatus;
  assignedSalesAgentId: ID | null;
}

export type MaterialSource = "vendor_supplied" | "customer_supplied" | "undecided";

/**
 * The workhorse of the schema: one row per service the customer selected.
 * Each row runs its own assignment, quoting and execution track, which is why
 * "just a dining table" and "2BHK + gate + painting" need no special-casing.
 */
export type LeadDomainStatus =
  | "pending_assignment"
  | "assigned"
  | "quoted"
  | "vendor_selected"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface LeadDomain extends BaseRecord {
  id: ID;
  leadId: ID;
  domainId: ID;
  /** Tracked per domain: a client can supply their own wood but not their own paint. */
  materialSource: MaterialSource;
  status: LeadDomainStatus;
  /**
   * A professional the client asked for by name, usually after browsing their
   * profile. A preference, never a promise: ops try to include them among the
   * three, and tell the client when they cannot.
   */
  preferredProfessionalId: ID | null;
  /** Why a requested professional could not be included, shown to the client. */
  preferenceUnmetReason: string | null;
  /** Set once the client picks a vendor for this domain. */
  selectedProfessionalId: ID | null;
  selectedQuoteId: ID | null;
}

export type AssignmentResponse = "pending" | "accepted" | "rejected";

/**
 * Which professionals were offered this lead-domain. Assignment is manual:
 * admin calls the vendor, confirms availability, then assigns.
 */
export interface LeadDomainAssignment extends BaseRecord {
  id: ID;
  leadDomainId: ID;
  professionalId: ID;
  responseStatus: AssignmentResponse;
  assignedAt: string;
  respondedAt: string | null;
  rejectionReason: string | null;
}

/**
 * Bridge between the catalogue and the lead flow. When a customer browses
 * products or packages and enquires, their selection lands here so the vendor
 * quotes against exactly what was picked.
 */
export interface LeadDomainItem extends BaseRecord {
  id: ID;
  leadDomainId: ID;
  productId: ID | null;
  packageId: ID | null;
  /** Snapshot of the item name at selection time; catalogue names change. */
  itemName: string;
  quantity: number;
  /** Chosen variant labels, e.g. { Size: "6 seater", Finish: "Walnut" } */
  selectedOptions: Record<string, string>;
  indicativePrice: Rupees | null;
  customerNotes: string | null;
}

/** Call log for the sales panel — where the real scoping detail is captured. */
export interface LeadSalesActivity extends BaseRecord {
  id: ID;
  leadId: ID;
  salesAgentId: ID;
  callStatus:
    | "connected"
    | "not_reachable"
    | "busy"
    | "callback_requested"
    | "not_interested";
  remarks: string;
  recordingUrl: string | null;
  followUpDate: DateOnly | null;
}
