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
  adminTotalsSchema,
  agreementLineSchema,
  agreementProjectSchema,
  agreementViewSchema,
  assignmentViewSchema,
  blogPostViewSchema,
  citySliceSchema,
  clientRecordSchema,
  clientSummarySchema,
  commissionFocusRowSchema,
  commissionSummarySchema,
  domainCountSchema,
  domainPerformanceSchema,
  domainRatingSchema,
  domainSliceSchema,
  invoiceRowSchema,
  leadDomainViewSchema,
  leadProjectViewSchema,
  leadViewSchema,
  maskedClientSummarySchema,
  meetingViewSchema,
  myDayViewSchema,
  opsLeadRowSchema,
  packageLineSchema,
  packageViewSchema,
  productViewSchema,
  professionalDomainLinkSchema,
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
  urgencyCountSchema,
  vendorAgreementViewSchema,
  vendorDashboardSchema,
  vendorInvoiceViewSchema,
  vendorLeadCardSchema,
  vendorPerformanceSchema,
  vendorPoolEntrySchema,
  vendorProjectViewSchema,
  vendorReviewSchema,
  vendorRowSchema,
  vendorVisitViewSchema,
} from "./schema/views";

/* ------------------------------------------------------------------ *
 * Nested shapes, named
 *
 * These were anonymous objects inside the view models until the Dart generator
 * turned each one into a class called `DomainRating2`, `Lines2`, `Invoice2` —
 * numbered by whichever field it met first, and mutually unassignable. Naming
 * them fixed the generated client and gave the TypeScript side a vocabulary for
 * shapes it could previously only describe inline.
 * ------------------------------------------------------------------ */

/** A vendor's rating in one trade. */
export type DomainRating = z.infer<typeof domainRatingSchema>;

/** One professional offered a service, with who they are. */
export type AssignmentView = z.infer<typeof assignmentViewSchema>;

/** One visit, with the professional attending it. */
export type MeetingView = z.infer<typeof meetingViewSchema>;

/** One service covered by an agreement, at the price agreed for it. */
export type AgreementLine = z.infer<typeof agreementLineSchema>;

/** A project under an agreement, and which trade it is. */
export type AgreementProject = z.infer<typeof agreementProjectSchema>;

/** One line inside a package. Not always a catalogue product. */
export type PackageLine = z.infer<typeof packageLineSchema>;

/** A trade a vendor is approved for, with the approval itself. */
export type ProfessionalDomainLink = z.infer<typeof professionalDomainLinkSchema>;

/** How a vendor performs in one trade. Per-trade is the point. */
export type DomainPerformance = z.infer<typeof domainPerformanceSchema>;

/** A review as the vendor sees it — the customer named, never contactable. */
export type VendorReview = z.infer<typeof vendorReviewSchema>;

export type UrgencyCount = z.infer<typeof urgencyCountSchema>;
export type DomainCount = z.infer<typeof domainCountSchema>;

/** The commission block on My Day: the totals, and the rows behind them. */
export type CommissionSummary = z.infer<typeof commissionSummarySchema>;

export type AdminTotals = z.infer<typeof adminTotalsSchema>;
export type CitySlice = z.infer<typeof citySliceSchema>;

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
