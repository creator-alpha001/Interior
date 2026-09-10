/**
 * View models: the joined, denormalised shapes the UI actually renders.
 *
 * Screens never assemble joins themselves — the data layer returns these, so
 * when the mock adapter is swapped for real HTTP endpoints the components do
 * not change. These are what a single API response carries, and what the
 * generated Dart models on mobile mirror.
 */
import { z } from "zod";
import { citySchema, idSchema, rupeesSchema, timestampSchema } from "./common";
import { agreementLeadDomainSchema, agreementSchema } from "./agreements";
import {
  commissionInvoiceSchema,
  projectMilestoneSchema,
  projectSchema,
  reviewSchema,
  supportTicketSchema,
} from "./execution";
import { domainSchema, portfolioItemSchema, professionalDomainSchema } from "./domains";
import {
  leadDomainAssignmentSchema,
  leadDomainItemSchema,
  leadDomainSchema,
  leadSalesActivitySchema,
  leadSchema,
  materialSourceSchema,
  urgencySchema,
} from "./leads";
import { meetingSchema, messageSchema, quoteSchema } from "./flow";
import { blogCategorySchema, blogPostSchema } from "./content";
import { productCategorySchema, productSchema, servicePackageSchema } from "./catalog";
import {
  clientSchema,
  professionalApplicationSchema,
  professionalSchema,
  userSchema,
} from "./identity";

/**
 * A vendor's rating *in one trade*.
 *
 * Named rather than inlined, like every other nested shape in this file. An
 * anonymous object here becomes an anonymous class in the generated Dart, under
 * a name derived from whichever field the generator met first — `DomainRating2`,
 * `DomainRating3` — and nothing is assignable to anything else.
 */
export const domainRatingSchema = z.object({
  domainId: idSchema,
  avgRating: z.number(),
  ratingCount: z.number().int(),
});

export const professionalSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  companyName: z.string(),
  avatarUrl: z.string().nullable(),
  /**
   * Where this vendor is, or null when nothing on record says.
   *
   * Nullable since migration 0012 made `users.city_id` nullable — a Google
   * sign-in may never have been asked. It was not made nullable *here* at the
   * time, and the queries went on inner-joining the city, which does not
   * produce a missing city on a card: it drops the vendor from the directory
   * altogether. A vendor nobody can find is a worse answer than one whose
   * location is not shown.
   *
   * Resolved as the first city they actually serve, falling back to the city on
   * their account. For a vendor those are answers to different questions, and
   * "where do you work" is the one a customer is asking.
   */
  city: citySchema.nullable(),
  experienceYears: z.number(),
  completedProjects: z.number().int(),
  avgRating: z.number(),
  ratingCount: z.number().int(),
  languages: z.array(z.string()),
  isVerified: z.boolean(),
  avgResponseHours: z.number(),
  domains: z.array(domainSchema),
  /** Per-domain rating, when viewing this vendor in the context of one domain. */
  domainRating: domainRatingSchema.optional(),
});

export const reviewViewSchema = z.object({
  review: reviewSchema,
  clientName: z.string(),
  domain: domainSchema,
  projectTitle: z.string(),
});

export const professionalProfileSchema = professionalSummarySchema.extend({
  professional: professionalSchema,
  user: userSchema,
  bio: z.string(),
  domainStats: z.array(professionalDomainSchema),
  serviceCities: z.array(citySchema),
  portfolio: z.array(portfolioItemSchema),
  reviews: z.array(reviewViewSchema),
});

export const clientSummarySchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: z.string(),
  /** Null until they give one; ops collect it on the call if the lead needs it. */
  mobile: z.string().nullable(),
  email: z.string().nullable(),
  /**
   * Null when they have not told us where they are.
   *
   * Ops screens show this as "not set" rather than a city name. It is not the
   * same question as a lead's city, which is always present — a requirement
   * asks where the work is, and the answer is a property of the job rather than
   * of the person who raised it.
   */
  city: citySchema.nullable(),
  address: z.string().nullable(),
});

/**
 * What a vendor is allowed to see about a client.
 *
 * Contact details are never exposed to the vendor panel. The locality is
 * released so they can judge travel and price the job; the full address is
 * released only for a confirmed site visit, and the mobile number is never
 * released at all — the platform coordinates every conversation.
 *
 * There is deliberately no `mobile` and no `email` key here. A leak would have
 * to be a change to this schema, not an oversight in a query — and because the
 * mobile client's models are generated from it, that property now reaches the
 * phone as well as the browser.
 */
export const maskedClientSummarySchema = z.object({
  /** First name plus initial, e.g. "Priya S." */
  displayName: z.string(),
  /**
   * Where a lead is in context this is the lead's city and is always present.
   * On the agreements screen there is no lead in context, so it falls back to
   * the account's own city — which may be null, because signup does not insist
   * on one. Render `locality` alone rather than the word "null".
   */
  city: citySchema.nullable(),
  locality: z.string(),
  /** Full address, present only once a visit has been confirmed. */
  address: z.string().nullable(),
  contactReleased: z.literal(false),
});

export const quoteViewSchema = z.object({
  quote: quoteSchema,
  professional: professionalSummarySchema,
  domain: domainSchema,
});

/** One professional offered this service, with who they are. */
export const assignmentViewSchema = z.object({
  assignment: leadDomainAssignmentSchema,
  professional: professionalSummarySchema,
});

/** One visit, with the professional attending it. */
export const meetingViewSchema = z.object({
  meeting: meetingSchema,
  professional: professionalSummarySchema,
});

/** One service track inside a requirement, with everything hanging off it. */
export const leadDomainViewSchema = z.object({
  leadDomain: leadDomainSchema,
  domain: domainSchema,
  assignments: z.array(assignmentViewSchema),
  quotes: z.array(quoteViewSchema),
  meetings: z.array(meetingViewSchema),
  items: z.array(leadDomainItemSchema),
  selectedProfessional: professionalSummarySchema.nullable(),
  /** Unread messages in the client's thread with the platform. */
  unreadMessages: z.number().int(),
});

export const leadViewSchema = z.object({
  lead: leadSchema,
  client: clientSummarySchema,
  city: citySchema,
  domains: z.array(leadDomainViewSchema),
  /** Convenience flags for list screens. */
  domainNames: z.array(z.string()),
  isMultiDomain: z.boolean(),
});

export const projectViewSchema = z.object({
  project: projectSchema,
  domain: domainSchema,
  professional: professionalSummarySchema,
  client: clientSummarySchema,
  review: reviewSchema.nullable(),
});

/**
 * One service covered by an agreement, at the price agreed for it.
 *
 * Shared by the customer and vendor views of an agreement: it is the same line,
 * and a combined agreement has several.
 */
export const agreementLineSchema = z.object({
  link: agreementLeadDomainSchema,
  domain: domainSchema,
  quote: quoteSchema,
});

export const agreementViewSchema = z.object({
  agreement: agreementSchema,
  professional: professionalSummarySchema,
  client: clientSummarySchema,
  lines: z.array(agreementLineSchema),
  /** True when one professional covers several domains under one contract. */
  isCombined: z.boolean(),
  projects: z.array(projectViewSchema),
  invoice: commissionInvoiceSchema.nullable(),
});

export const productViewSchema = z.object({
  product: productSchema,
  domain: domainSchema,
  category: productCategorySchema,
  /** Price after city override, when a city is in context. */
  effectivePrice: rupeesSchema,
});

/** One line inside a package. Not always a catalogue product. */
export const packageLineSchema = z.object({
  label: z.string(),
  quantity: z.number(),
  productId: idSchema.nullable(),
});

export const packageViewSchema = z.object({
  servicePackage: servicePackageSchema,
  domain: domainSchema,
  items: z.array(packageLineSchema),
});

export const blogPostViewSchema = z.object({
  post: blogPostSchema,
  category: blogCategorySchema,
  tags: z.array(z.string()),
  domain: domainSchema.nullable(),
});

/** Everything one search box query can turn up, ranked by intent. */
export const searchResultsSchema = z.object({
  query: z.string(),
  total: z.number().int(),
  products: z.array(productViewSchema),
  packages: z.array(packageViewSchema),
  professionals: z.array(professionalSummarySchema),
  posts: z.array(blogPostViewSchema),
});

export const clientRecordSchema = z.object({
  client: clientSchema,
  user: userSchema,
});

/* ------------------------------------------------------------------ *
 * The vendor portal
 *
 * These shapes exist to be *incapable* of carrying a customer's contact
 * details. Everywhere a client appears it is a `maskedClientSummarySchema`,
 * which has no field for a phone number or an email.
 * ------------------------------------------------------------------ */

/** One lead offered to one vendor. */
export const vendorLeadCardSchema = z.object({
  assignment: leadDomainAssignmentSchema,
  leadDomain: leadDomainSchema,
  domain: domainSchema,
  leadReference: z.string(),
  client: maskedClientSummarySchema,
  /** The client's own description of the job. */
  description: z.string(),
  urgency: z.string(),
  materialSource: materialSourceSchema,
  items: z.array(leadDomainItemSchema),
  /** The brief our team captured on the call — the real scope. */
  brief: z.string().nullable(),
  siteNotes: z.array(z.string()),
  budgetMax: rupeesSchema.nullable(),
  myQuote: quoteSchema.nullable(),
  visits: z.array(meetingSchema),
  unreadMessages: z.number().int(),
  /**
   * How many others are quoting. Stated plainly so nobody assumes the job is
   * theirs.
   */
  competingQuotes: z.number().int(),
  /**
   * Decided server-side. A screen comparing `selectedProfessionalId` against a
   * hardcoded "who am I" is a bug waiting for the day that value is wrong.
   */
  won: z.boolean(),
  lost: z.boolean(),
});

/** A trade a vendor is approved for, with the approval itself. */
export const professionalDomainLinkSchema = z.object({
  link: professionalDomainSchema,
  domain: domainSchema,
});

export const vendorDashboardSchema = z.object({
  professional: professionalSchema,
  displayName: z.string(),
  domains: z.array(professionalDomainLinkSchema),
  newLeads: z.number().int(),
  awaitingQuote: z.number().int(),
  quotesOut: z.number().int(),
  wonThisPeriod: z.number().int(),
  liveProjects: z.number().int(),
  visitsToday: z.number().int(),
  commissionDue: rupeesSchema,
  commissionOverdue: rupeesSchema,
  unreadMessages: z.number().int(),
});

/** A project under an agreement, and which trade it is. */
export const agreementProjectSchema = z.object({
  project: projectSchema,
  domain: domainSchema,
});

export const vendorAgreementViewSchema = z.object({
  agreement: agreementSchema,
  client: maskedClientSummarySchema,
  lines: z.array(agreementLineSchema),
  isCombined: z.boolean(),
  projects: z.array(agreementProjectSchema),
  invoice: commissionInvoiceSchema.nullable(),
});

export const vendorProjectViewSchema = z.object({
  project: projectSchema,
  domain: domainSchema,
  client: maskedClientSummarySchema,
  cityName: z.string(),
  review: reviewSchema.nullable(),
});

/**
 * How a vendor performs in one trade.
 *
 * Per-trade is the point: excellent at painting, average at carpentry, shown as
 * exactly that rather than averaged into one number.
 */
export const domainPerformanceSchema = z.object({
  domain: domainSchema,
  rating: z.number(),
  ratingCount: z.number().int(),
  completed: z.number().int(),
  won: z.number().int(),
  lost: z.number().int(),
  winRatePercent: z.number(),
  commissionPercent: z.number(),
});

/** A review as the vendor sees it — the customer named, never contactable. */
export const vendorReviewSchema = z.object({
  review: reviewSchema,
  domain: domainSchema,
  clientName: z.string(),
});

export const vendorPerformanceSchema = z.object({
  byDomain: z.array(domainPerformanceSchema),
  avgResponseHours: z.number(),
  totalRevenue: rupeesSchema,
  reviews: z.array(vendorReviewSchema),
});

export const vendorInvoiceViewSchema = z.object({
  invoice: commissionInvoiceSchema,
  agreementReference: z.string(),
  domains: z.array(z.string()),
});

export const vendorVisitViewSchema = z.object({
  meeting: meetingSchema,
  domain: domainSchema,
  client: maskedClientSummarySchema,
  leadReference: z.string(),
});

/* ------------------------------------------------------------------ *
 * The ops panel
 *
 * Staff see the customer unmasked — a coordinator cannot ring somebody they
 * have no number for. That is the difference between this section and the
 * vendor one above, and it is why the two apps deploy separately.
 * ------------------------------------------------------------------ */

export const opsLeadRowSchema = z.object({
  lead: leadViewSchema,
  agentName: z.string().nullable(),
  lastActivity: leadSalesActivitySchema.nullable(),
  followUpDate: z.string().nullable(),
  /** Services still waiting on us to assign professionals. */
  unassignedDomains: z.number().int(),
  /** Client questions with no reply from us yet. */
  awaitingReply: z.number().int(),
  ageDays: z.number().int(),
});

export const relayThreadSchema = z.object({
  professional: professionalSummarySchema,
  messages: z.array(messageSchema),
  /** True when their last message has had no reply from us. */
  awaitingReply: z.boolean(),
});

/**
 * Both sides of one service, side by side.
 *
 * The client thread on the left, one thread per assigned vendor on the right —
 * because a question asked once should go to all of them, not to whichever
 * vendor happened to ask.
 */
export const relayViewSchema = z.object({
  leadDomainId: idSchema,
  domain: domainSchema,
  clientName: z.string(),
  clientThread: z.array(messageSchema),
  clientAwaitingReply: z.boolean(),
  vendorThreads: z.array(relayThreadSchema),
});

export const vendorPoolEntrySchema = z.object({
  professional: professionalSummarySchema,
  isAssigned: z.boolean(),
  /** The client asked for this one by name. */
  isPreferred: z.boolean(),
  /** How many other live leads they are already quoting on. */
  activeLoad: z.number().int(),
});

export const timelineKindSchema = z.enum([
  "created",
  "call",
  "assigned",
  "quote",
  "meeting",
  "message",
  "selected",
  "agreement",
  "project",
  "stage",
  "review",
]);

export const timelineEventSchema = z.object({
  id: idSchema,
  kind: timelineKindSchema,
  at: timestampSchema,
  title: z.string(),
  detail: z.string().nullable(),
  domainName: z.string().nullable(),
  actor: z.string().nullable(),
});

export const leadProjectViewSchema = z.object({
  projectId: idSchema,
  reference: z.string(),
  leadDomainId: idSchema,
  domainName: z.string(),
  professionalName: z.string(),
  professionalId: idSchema,
  status: z.string(),
  completionPercent: z.number(),
  approvedStages: z.number().int(),
  totalStages: z.number().int(),
  awaitingReview: z.number().int(),
  currentStage: z.string().nullable(),
  milestones: z.array(projectMilestoneSchema),
});

export const commissionFocusRowSchema = z.object({
  invoiceId: idSchema,
  reference: z.string(),
  professionalId: idSchema,
  professionalName: z.string(),
  amount: rupeesSchema,
  dueDate: z.string(),
  status: z.string(),
  daysOverdue: z.number().int(),
  domains: z.array(z.string()),
});

export const urgencyCountSchema = z.object({
  urgency: urgencySchema,
  count: z.number().int(),
});

export const domainCountSchema = z.object({
  domain: domainSchema,
  count: z.number().int(),
});

export const salesDashboardSchema = z.object({
  agentName: z.string(),
  target: z.number().int(),
  newLeads: z.number().int(),
  needsAssignment: z.number().int(),
  awaitingReply: z.number().int(),
  followUpsDue: z.number().int(),
  visitsToday: z.number().int(),
  byUrgency: z.array(urgencyCountSchema),
  byDomain: z.array(domainCountSchema),
});

/** The commission block on My Day: the totals, and the rows behind them. */
export const commissionSummarySchema = z.object({
  pending: rupeesSchema,
  overdue: rupeesSchema,
  overdueCount: z.number().int(),
  dueSoonCount: z.number().int(),
  rows: z.array(commissionFocusRowSchema),
});

export const myDayViewSchema = z.object({
  agentName: z.string(),
  target: z.number().int(),
  live: z.array(opsLeadRowSchema),
  awaitingReply: z.array(opsLeadRowSchema),
  needsAssignment: z.array(opsLeadRowSchema),
  followUpsDue: z.array(opsLeadRowSchema),
  neverCalled: z.array(opsLeadRowSchema),
  stalled: z.array(opsLeadRowSchema),
  visitsToday: z.number().int(),
  visitsNeedingOutcome: z.number().int(),
  commission: commissionSummarySchema,
});

export const domainSliceSchema = z.object({
  domain: domainSchema,
  leads: z.number().int(),
  quoted: z.number().int(),
  won: z.number().int(),
  revenue: rupeesSchema,
  commission: rupeesSchema,
  avgTicket: rupeesSchema,
  conversionPercent: z.number(),
  vendors: z.number().int(),
});

export const adminTotalsSchema = z.object({
  leads: z.number().int(),
  activeLeads: z.number().int(),
  vendors: z.number().int(),
  pendingVerification: z.number().int(),
  revenue: rupeesSchema,
  commissionBilled: rupeesSchema,
  commissionPending: rupeesSchema,
  commissionOverdue: rupeesSchema,
  openTickets: z.number().int(),
});

export const citySliceSchema = z.object({
  cityName: z.string(),
  leads: z.number().int(),
  revenue: rupeesSchema,
});

export const adminDashboardSchema = z.object({
  totals: adminTotalsSchema,
  byDomain: z.array(domainSliceSchema),
  byCity: z.array(citySliceSchema),
});

export const vendorRowSchema = z.object({
  professional: professionalSchema,
  summary: professionalSummarySchema,
  domainLinks: z.array(professionalDomainLinkSchema),
  serviceCities: z.array(z.string()),
  liveJobs: z.number().int(),
  pendingDomainRequests: z.number().int(),
  totalRevenue: rupeesSchema,
  outstandingCommission: rupeesSchema,
  /** Unsigned vendors are in no lead pool, however verified they are. */
  hasSignedPartnerAgreement: z.boolean(),
});

export const invoiceRowSchema = z.object({
  invoice: commissionInvoiceSchema,
  professional: professionalSummarySchema,
  agreementReference: z.string(),
  domains: z.array(z.string()),
  isCombined: z.boolean(),
  daysOverdue: z.number().int(),
});

export const adminTicketRowSchema = z.object({
  ticket: supportTicketSchema,
  raisedByName: z.string(),
  raisedByRole: z.string(),
});

/**
 * An application with the names behind its ids.
 *
 * The record stores domain and city ids; a reviewer needs to read "Carpentry
 * and Painting, in Bengaluru". Resolved server-side rather than by the screen,
 * for the same reason as every other view here: the admin panel and the
 * applicant's own status screen would otherwise each assemble the join, and
 * only one of them would be updated when a trade is renamed.
 */
export const professionalApplicationViewSchema = z.object({
  application: professionalApplicationSchema,
  applicantName: z.string(),
  applicantMobile: z.string().nullable(),
  applicantEmail: z.string().nullable(),
  requestedDomains: z.array(domainSchema),
  serviceCities: z.array(citySchema),
  /** How many requirements they have raised as a customer. Ops context. */
  requirementsRaised: z.number().int(),
});
