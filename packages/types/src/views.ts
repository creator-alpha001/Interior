/**
 * View models: the joined, denormalised shapes the UI actually renders.
 *
 * Screens never assemble joins themselves — the data layer returns these, so
 * when the mock adapter is swapped for real HTTP endpoints the components do
 * not change.
 *
 * Every type here is inferred from `./schema/views`, which is also what the
 * API validates against and what the mobile app's Dart models are generated
 * from. Three surfaces, one definition.
 */
import type { z } from "zod";
import type {
  adminDashboardSchema,
  adminTicketRowSchema,
  agreementViewSchema,
  blogPostViewSchema,
  clientRecordSchema,
  clientSummarySchema,
  commissionFocusRowSchema,
  domainSliceSchema,
  invoiceRowSchema,
  leadDomainViewSchema,
  leadProjectViewSchema,
  leadViewSchema,
  maskedClientSummarySchema,
  myDayViewSchema,
  opsLeadRowSchema,
  packageViewSchema,
  productViewSchema,
  professionalProfileSchema,
  professionalSummarySchema,
  projectViewSchema,
  quoteViewSchema,
  relayThreadSchema,
  relayViewSchema,
  reviewViewSchema,
  salesDashboardSchema,
  searchResultsSchema,
  timelineEventSchema,
  timelineKindSchema,
  vendorAgreementViewSchema,
  vendorDashboardSchema,
  vendorInvoiceViewSchema,
  vendorLeadCardSchema,
  vendorPerformanceSchema,
  vendorPoolEntrySchema,
  vendorProjectViewSchema,
  vendorRowSchema,
  vendorVisitViewSchema,
} from "./schema/views";

export type ProfessionalSummary = z.infer<typeof professionalSummarySchema>;

export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;

export type ReviewView = z.infer<typeof reviewViewSchema>;

export type ClientSummary = z.infer<typeof clientSummarySchema>;

/**
 * What a vendor is allowed to see about a client.
 *
 * Contact details are never exposed to the vendor panel. The locality is
 * released so they can judge travel and price the job; the full address is
 * released only for a confirmed site visit, and the mobile number is never
 * released at all — the platform coordinates every conversation.
 */
export type MaskedClientSummary = z.infer<typeof maskedClientSummarySchema>;

/** One service track inside a requirement, with everything hanging off it. */
export type LeadDomainView = z.infer<typeof leadDomainViewSchema>;

export type LeadView = z.infer<typeof leadViewSchema>;

export type QuoteView = z.infer<typeof quoteViewSchema>;

export type AgreementView = z.infer<typeof agreementViewSchema>;

export type ProjectView = z.infer<typeof projectViewSchema>;

export type ProductView = z.infer<typeof productViewSchema>;

export type PackageView = z.infer<typeof packageViewSchema>;

export type BlogPostView = z.infer<typeof blogPostViewSchema>;

/** Everything one search box query can turn up, ranked by intent. */
export type SearchResults = z.infer<typeof searchResultsSchema>;

export type ClientRecord = z.infer<typeof clientRecordSchema>;

/* ------------------------------------------------------------------ *
 * The vendor portal
 *
 * These shapes exist to be *incapable* of carrying a customer's contact
 * details. Everywhere a client appears it is a `MaskedClientSummary`, which has
 * no field for a phone number or an email — so a leak would have to be a
 * deliberate change to the type, not an oversight in a query.
 * ------------------------------------------------------------------ */

/** One lead offered to one vendor. */
export type VendorLeadCard = z.infer<typeof vendorLeadCardSchema>;

export type VendorDashboard = z.infer<typeof vendorDashboardSchema>;

export type VendorAgreementView = z.infer<typeof vendorAgreementViewSchema>;

export type VendorProjectView = z.infer<typeof vendorProjectViewSchema>;

export type VendorPerformance = z.infer<typeof vendorPerformanceSchema>;

export type VendorInvoiceView = z.infer<typeof vendorInvoiceViewSchema>;

export type VendorVisitView = z.infer<typeof vendorVisitViewSchema>;

/* ------------------------------------------------------------------ *
 * The ops panel
 *
 * Staff see the customer unmasked — a coordinator cannot ring somebody they
 * have no number for. That is the difference between this section and the
 * vendor one above, and it is why the two apps deploy separately.
 * ------------------------------------------------------------------ */

export type OpsLeadRow = z.infer<typeof opsLeadRowSchema>;

export type RelayThread = z.infer<typeof relayThreadSchema>;

/**
 * Both sides of one service, side by side.
 *
 * The client thread on the left, one thread per assigned vendor on the right —
 * because a question asked once should go to all of them, not to whichever
 * vendor happened to ask.
 */
export type RelayView = z.infer<typeof relayViewSchema>;

export type VendorPoolEntry = z.infer<typeof vendorPoolEntrySchema>;

export type TimelineKind = z.infer<typeof timelineKindSchema>;

export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export type LeadProjectView = z.infer<typeof leadProjectViewSchema>;

export type CommissionFocusRow = z.infer<typeof commissionFocusRowSchema>;

export type SalesDashboard = z.infer<typeof salesDashboardSchema>;

export type MyDayView = z.infer<typeof myDayViewSchema>;

export type DomainSlice = z.infer<typeof domainSliceSchema>;

export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

export type VendorRow = z.infer<typeof vendorRowSchema>;

export type InvoiceRow = z.infer<typeof invoiceRowSchema>;

export type AdminTicketRow = z.infer<typeof adminTicketRowSchema>;
