import { z } from "zod";
import {
  baseRecordSchema,
  dateOnlySchema,
  idSchema,
  mediaAssetSchema,
  rupeesSchema,
} from "./common";

export const urgencySchema = z.enum(["immediate", "within_month", "exploring"]);

export const siteAccessibilityTagSchema = z.enum([
  "parking",
  "lift",
  "timing_restriction",
  "other",
]);

export const leadSourceSchema = z.enum([
  "app",
  "website",
  "referral",
  "sales_call",
  "catalogue",
]);

/**
 * Derived from the lead's LeadDomain rows, never set directly:
 * - new        : no domain verified yet
 * - verified   : admin has validated the lead, assignment not started
 * - in_progress: at least one domain is past pending_assignment
 * - closed     : every domain is completed or cancelled
 * - archived   : manually archived by admin
 */
export const leadStatusSchema = z.enum([
  "new",
  "verified",
  "in_progress",
  "closed",
  "archived",
]);

/** One row per requirement submission, whatever number of services it spans. */
export const leadSchema = baseRecordSchema.extend({
  id: idSchema,
  reference: z.string(),
  clientId: idSchema,
  cityId: idSchema,
  /** The customer's own words. Detailed scoping happens on the sales call. */
  description: z.string(),
  urgency: urgencySchema,
  budgetMin: rupeesSchema.nullable(),
  budgetMax: rupeesSchema.nullable(),
  siteAccessibilityTags: z.array(siteAccessibilityTagSchema),
  photos: z.array(mediaAssetSchema),
  source: leadSourceSchema,
  overallStatus: leadStatusSchema,
  assignedSalesAgentId: idSchema.nullable(),
});

export const materialSourceSchema = z.enum([
  "vendor_supplied",
  "customer_supplied",
  "undecided",
]);

/**
 * The workhorse of the schema: one row per service the customer selected.
 * Each row runs its own assignment, quoting and execution track, which is why
 * "just a dining table" and "2BHK + gate + painting" need no special-casing.
 */
export const leadDomainStatusSchema = z.enum([
  "pending_assignment",
  "assigned",
  "quoted",
  "vendor_selected",
  "in_progress",
  "completed",
  "cancelled",
]);

export const leadDomainSchema = baseRecordSchema.extend({
  id: idSchema,
  leadId: idSchema,
  domainId: idSchema,
  /** Tracked per domain: a client can supply their own wood but not their own paint. */
  materialSource: materialSourceSchema,
  status: leadDomainStatusSchema,
  /**
   * A professional the client asked for by name, usually after browsing their
   * profile. A preference, never a promise: ops try to include them among the
   * three, and tell the client when they cannot.
   */
  preferredProfessionalId: idSchema.nullable(),
  /** Why a requested professional could not be included, shown to the client. */
  preferenceUnmetReason: z.string().nullable(),
  /** Set once the client picks a vendor for this domain. */
  selectedProfessionalId: idSchema.nullable(),
  selectedQuoteId: idSchema.nullable(),
});

export const assignmentResponseSchema = z.enum(["pending", "accepted", "rejected"]);

/**
 * Which professionals were offered this lead-domain. Assignment is manual:
 * admin calls the vendor, confirms availability, then assigns.
 */
export const leadDomainAssignmentSchema = baseRecordSchema.extend({
  id: idSchema,
  leadDomainId: idSchema,
  professionalId: idSchema,
  responseStatus: assignmentResponseSchema,
  assignedAt: z.string(),
  respondedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
});

/**
 * Bridge between the catalogue and the lead flow. When a customer browses
 * products or packages and enquires, their selection lands here so the vendor
 * quotes against exactly what was picked.
 */
export const leadDomainItemSchema = baseRecordSchema.extend({
  id: idSchema,
  leadDomainId: idSchema,
  productId: idSchema.nullable(),
  packageId: idSchema.nullable(),
  /** Snapshot of the item name at selection time; catalogue names change. */
  itemName: z.string(),
  quantity: z.number(),
  /** Chosen variant labels, e.g. { Size: "6 seater", Finish: "Walnut" } */
  selectedOptions: z.record(z.string(), z.string()),
  indicativePrice: rupeesSchema.nullable(),
  customerNotes: z.string().nullable(),
});

/** Call log for the sales panel — where the real scoping detail is captured. */
export const leadSalesActivitySchema = baseRecordSchema.extend({
  id: idSchema,
  leadId: idSchema,
  salesAgentId: idSchema,
  callStatus: z.enum([
    "connected",
    "not_reachable",
    "busy",
    "callback_requested",
    "not_interested",
  ]),
  remarks: z.string(),
  recordingUrl: z.string().nullable(),
  followUpDate: dateOnlySchema.nullable(),
});
