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
import { clientSchema, professionalSchema, userSchema } from "./identity";

export const professionalSummarySchema = z.object({
  id: idSchema,
  name: z.string(),
  companyName: z.string(),
  avatarUrl: z.string().nullable(),
  city: citySchema,
  experienceYears: z.number(),
  completedProjects: z.number(),
  avgRating: z.number(),
  ratingCount: z.number(),
  languages: z.array(z.string()),
  isVerified: z.boolean(),
  avgResponseHours: z.number(),
  domains: z.array(domainSchema),
  /** Per-domain rating, when viewing this vendor in the context of one domain. */
  domainRating: z
    .object({ domainId: idSchema, avgRating: z.number(), ratingCount: z.number() })
    .optional(),
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
  mobile: z.string(),
  email: z.string().nullable(),
  city: citySchema,
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
  city: citySchema,
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

/** One service track inside a requirement, with everything hanging off it. */
export const leadDomainViewSchema = z.object({
  leadDomain: leadDomainSchema,
  domain: domainSchema,
  assignments: z.array(
    z.object({
      assignment: leadDomainAssignmentSchema,
      professional: professionalSummarySchema,
    }),
  ),
  quotes: z.array(quoteViewSchema),
  meetings: z.array(
    z.object({ meeting: meetingSchema, professional: professionalSummarySchema }),
  ),
  items: z.array(leadDomainItemSchema),
  selectedProfessional: professionalSummarySchema.nullable(),
  /** Unread messages in the client's thread with the platform. */
  unreadMessages: z.number(),
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

export const agreementViewSchema = z.object({
  agreement: agreementSchema,
  professional: professionalSummarySchema,
  client: clientSummarySchema,
  lines: z.array(
    z.object({
      link: agreementLeadDomainSchema,
      domain: domainSchema,
      quote: quoteSchema,
    }),
  ),
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

export const packageViewSchema = z.object({
  servicePackage: servicePackageSchema,
  domain: domainSchema,
  items: z.array(
    z.object({
      label: z.string(),
      quantity: z.number(),
      productId: idSchema.nullable(),
    }),
  ),
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
  total: z.number(),
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
  unreadMessages: z.number(),
  /**
   * How many others are quoting. Stated plainly so nobody assumes the job is
   * theirs.
   */
  competingQuotes: z.number(),
  /**
   * Decided server-side. A screen comparing `selectedProfessionalId` against a
   * hardcoded "who am I" is a bug waiting for the day that value is wrong.
   */
  won: z.boolean(),
  lost: z.boolean(),
});

export const vendorDashboardSchema = z.object({
  professional: professionalSchema,
  displayName: z.string(),
  domains: z.array(z.object({ link: professionalDomainSchema, domain: domainSchema })),
  newLeads: z.number(),
  awaitingQuote: z.number(),
  quotesOut: z.number(),
  wonThisPeriod: z.number(),
  liveProjects: z.number(),
  visitsToday: z.number(),
  commissionDue: rupeesSchema,
  commissionOverdue: rupeesSchema,
  unreadMessages: z.number(),
});

export const vendorAgreementViewSchema = z.object({
  agreement: agreementSchema,
  client: maskedClientSummarySchema,
  lines: z.array(
    z.object({
      link: agreementLeadDomainSchema,
      domain: domainSchema,
      quote: quoteSchema,
    }),
  ),
  isCombined: z.boolean(),
  projects: z.array(z.object({ project: projectSchema, domain: domainSchema })),
  invoice: commissionInvoiceSchema.nullable(),
});

export const vendorProjectViewSchema = z.object({
  project: projectSchema,
  domain: domainSchema,
  client: maskedClientSummarySchema,
  cityName: z.string(),
  review: reviewSchema.nullable(),
});

export const vendorPerformanceSchema = z.object({
  byDomain: z.array(
    z.object({
      domain: domainSchema,
      rating: z.number(),
      ratingCount: z.number(),
      completed: z.number(),
      won: z.number(),
      lost: z.number(),
      winRatePercent: z.number(),
      commissionPercent: z.number(),
    }),
  ),
  avgResponseHours: z.number(),
  totalRevenue: rupeesSchema,
  reviews: z.array(
    z.object({
      review: reviewSchema,
      domain: domainSchema,
      clientName: z.string(),
    }),
  ),
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
  unassignedDomains: z.number(),
  /** Client questions with no reply from us yet. */
  awaitingReply: z.number(),
  ageDays: z.number(),
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
  activeLoad: z.number(),
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
  approvedStages: z.number(),
  totalStages: z.number(),
  awaitingReview: z.number(),
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
  daysOverdue: z.number(),
  domains: z.array(z.string()),
});

export const salesDashboardSchema = z.object({
  agentName: z.string(),
  target: z.number(),
  newLeads: z.number(),
  needsAssignment: z.number(),
  awaitingReply: z.number(),
  followUpsDue: z.number(),
  visitsToday: z.number(),
  byUrgency: z.array(z.object({ urgency: urgencySchema, count: z.number() })),
  byDomain: z.array(z.object({ domain: domainSchema, count: z.number() })),
});

export const myDayViewSchema = z.object({
  agentName: z.string(),
  target: z.number(),
  live: z.array(opsLeadRowSchema),
  awaitingReply: z.array(opsLeadRowSchema),
  needsAssignment: z.array(opsLeadRowSchema),
  followUpsDue: z.array(opsLeadRowSchema),
  neverCalled: z.array(opsLeadRowSchema),
  stalled: z.array(opsLeadRowSchema),
  visitsToday: z.number(),
  visitsNeedingOutcome: z.number(),
  commission: z.object({
    pending: rupeesSchema,
    overdue: rupeesSchema,
    overdueCount: z.number(),
    dueSoonCount: z.number(),
    rows: z.array(commissionFocusRowSchema),
  }),
});

export const domainSliceSchema = z.object({
  domain: domainSchema,
  leads: z.number(),
  quoted: z.number(),
  won: z.number(),
  revenue: rupeesSchema,
  commission: rupeesSchema,
  avgTicket: rupeesSchema,
  conversionPercent: z.number(),
  vendors: z.number(),
});

export const adminDashboardSchema = z.object({
  totals: z.object({
    leads: z.number(),
    activeLeads: z.number(),
    vendors: z.number(),
    pendingVerification: z.number(),
    revenue: rupeesSchema,
    commissionBilled: rupeesSchema,
    commissionPending: rupeesSchema,
    commissionOverdue: rupeesSchema,
    openTickets: z.number(),
  }),
  byDomain: z.array(domainSliceSchema),
  byCity: z.array(
    z.object({ cityName: z.string(), leads: z.number(), revenue: rupeesSchema }),
  ),
});

export const vendorRowSchema = z.object({
  professional: professionalSchema,
  summary: professionalSummarySchema,
  domainLinks: z.array(
    z.object({ link: professionalDomainSchema, domain: domainSchema }),
  ),
  serviceCities: z.array(z.string()),
  liveJobs: z.number(),
  pendingDomainRequests: z.number(),
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
  daysOverdue: z.number(),
});

export const adminTicketRowSchema = z.object({
  ticket: supportTicketSchema,
  raisedByName: z.string(),
  raisedByRole: z.string(),
});
