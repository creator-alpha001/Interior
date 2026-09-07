/** The requirement, and the per-service tracks everything else hangs off. */
import type { z } from "zod";
import type {
  assignmentResponseSchema,
  leadDomainAssignmentSchema,
  leadDomainItemSchema,
  leadDomainSchema,
  leadDomainStatusSchema,
  leadSalesActivitySchema,
  leadSchema,
  leadSourceSchema,
  leadStatusSchema,
  materialSourceSchema,
  siteAccessibilityTagSchema,
  urgencySchema,
} from "./schema/leads";

export type Urgency = z.infer<typeof urgencySchema>;

export type SiteAccessibilityTag = z.infer<typeof siteAccessibilityTagSchema>;

export type LeadSource = z.infer<typeof leadSourceSchema>;

/**
 * Derived from the lead's LeadDomain rows, never set directly:
 * - new        : no domain verified yet
 * - verified   : admin has validated the lead, assignment not started
 * - in_progress: at least one domain is past pending_assignment
 * - closed     : every domain is completed or cancelled
 * - archived   : manually archived by admin
 */
export type LeadStatus = z.infer<typeof leadStatusSchema>;

/** One row per requirement submission, whatever number of services it spans. */
export type Lead = z.infer<typeof leadSchema>;

export type MaterialSource = z.infer<typeof materialSourceSchema>;

/**
 * The workhorse of the schema: one row per service the customer selected.
 * Each row runs its own assignment, quoting and execution track, which is why
 * "just a dining table" and "2BHK + gate + painting" need no special-casing.
 */
export type LeadDomainStatus = z.infer<typeof leadDomainStatusSchema>;

export type LeadDomain = z.infer<typeof leadDomainSchema>;

export type AssignmentResponse = z.infer<typeof assignmentResponseSchema>;

/**
 * Which professionals were offered this lead-domain. Assignment is manual:
 * admin calls the vendor, confirms availability, then assigns.
 */
export type LeadDomainAssignment = z.infer<typeof leadDomainAssignmentSchema>;

/**
 * Bridge between the catalogue and the lead flow. When a customer browses
 * products or packages and enquires, their selection lands here so the vendor
 * quotes against exactly what was picked.
 */
export type LeadDomainItem = z.infer<typeof leadDomainItemSchema>;

/** Call log for the sales panel — where the real scoping detail is captured. */
export type LeadSalesActivity = z.infer<typeof leadSalesActivitySchema>;
