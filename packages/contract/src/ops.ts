/**
 * The ops panel.
 *
 * Requires a staff session, and most routes additionally require a permission —
 * an operations manager works leads all day and should not be able to change a
 * commission rate. The permission each one needs is named beside it.
 */
import { z } from "zod";
import { hardcopyMethodSchema } from "@repo/types/schema";
import { idSchema, longText, mediaIdSchema, paginationSchema, shortText, slugSchema } from "./common";
import { route } from "./http";

export const leadQueueSchema = paginationSchema.extend({
  status: z.enum(["all", "new", "verified", "in_progress", "closed", "archived"]).optional(),
  domain: slugSchema.optional(),
  city: idSchema.optional(),
  urgency: z.enum(["immediate", "within_month", "exploring"]).optional(),
  agentId: idSchema.optional(),
  search: z.string().trim().max(120).optional(),
  needsAssignment: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (typeof v === "string" ? v === "true" : v)),
});

export const assignSchema = z.object({
  professionalIds: z.array(idSchema).min(1, "Choose at least one professional").max(6),
});

export const callLogSchema = z.object({
  callStatus: z.enum(["connected", "not_reachable", "busy", "callback_requested", "not_interested"]),
  remarks: z.string().trim().max(4000).default(""),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullish(),
});

export const scheduleVisitSchema = z.object({
  professionalId: idSchema,
  scheduledAt: z.string().datetime({ offset: true }),
  type: z.enum(["consultation", "site_visit", "measurement", "handover"]),
  notes: z.string().trim().max(1000).nullish(),
});

export const visitOutcomeSchema = z.object({
  outcome: longText(4000),
  /** Whether it changed the scope enough that quotes need revising. */
  changedScope: z.boolean().default(false),
});

/** Accepting or refusing something a vendor sent. A refusal must say why. */
export const verificationReviewSchema = z.object({
  decision: z.enum(["accept", "reject"]),
  note: z.string().trim().max(1000).nullish(),
});

export const receiveHardcopySchema = z.object({
  method: hardcopyMethodSchema,
  receivedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  note: z.string().trim().max(500).nullish(),
});

export const partnerTermsDocumentSchema = z.object({
  /** An uploaded `agreement_template` PDF; null removes the current one. */
  documentMediaId: mediaIdSchema.nullish(),
  hardcopyInstructions: z.string().trim().max(2000).optional(),
});

export const relaySchema = z.object({
  body: longText(2000),
  /** The message being carried across, so ops can see what came from where. */
  sourceMessageId: idSchema.optional(),
});

export const reviewProofSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(1000).nullish(),
});

/**
 * The per-trade captions on the compare-quotes table.
 *
 * Named rather than inline: an anonymous object here generated a second class
 * called `Labels` alongside the response side's `DomainLabels`, which is the
 * same shape under a different name.
 */
export const domainLabelsInputSchema = z.object({
  materials: shortText(80),
  warranty: shortText(80),
  pricingBasis: shortText(120),
});

export const domainInputSchema = z.object({
  name: shortText(80),
  tagline: z.string().trim().max(200).default(""),
  description: z.string().trim().max(2000).default(""),
  defaultCommissionPercent: z.number().int().min(0).max(50),
  labels: domainLabelsInputSchema,
  /**
   * The banner shown on the trade's own page, as an uploaded asset id.
   *
   * `domains.banner_url` and `domains.icon_key` have existed since the first
   * migration and nothing could ever write them — a trade created here got a
   * derived icon key and no picture at all, which is why every trade card in
   * the product falls back to a gradient.
   *
   * An id rather than a URL, even though the column stores a URL. An asset that
   * is never bound to an owner is precisely what the orphan sweep deletes, so
   * accepting a URL here would give a banner that worked all afternoon and was
   * gone by morning, with the column still pointing at it. The server attaches
   * the asset and derives the URL from it.
   *
   * Null clears the banner. Undefined leaves it alone.
   */
  bannerMediaId: idSchema.nullish(),
  iconKey: z.string().trim().max(60).optional(),
});

/* ---- catalogue ---- */

/**
 * Images are attached by id, not by URL.
 *
 * The upload issues a ticket and creates a `media_assets` row; the id here is
 * what binds that row to this record. Passing a URL instead would leave the
 * asset unowned, which is what the orphan sweep deletes, and the picture would
 * vanish a day later with nothing to explain it.
 *
 * Order is the array's order. Everything in the product reads `media[0]` as
 * the one to show on a card, so which one is first is a decision the person
 * filling this in is making whether they know it or not.
 */
const mediaIdsSchema = z.array(idSchema).max(12).default([]);

export const categoryInputSchema = z.object({
  domainId: idSchema,
  name: shortText(80),
  description: z.string().trim().max(1000).default(""),
  /** A category is a browsing shelf, so a picture is most of its job. */
  imageMediaId: idSchema.nullish(),
  /** For sub-categories. Null is a top-level shelf within the trade. */
  parentId: idSchema.nullish(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export const packageInputSchema = z.object({
  domainId: idSchema,
  name: shortText(120),
  shortDescription: z.string().trim().max(300).default(""),
  description: longText(4000).default(""),
  price: z.number().int().min(0),
  /** What the price is anchored to: "per 2BHK", "per 1000 sq.ft". */
  priceBasis: shortText(80),
  durationDays: z.number().int().min(0).max(3650).default(0),
  inclusions: z.array(shortText(160)).max(40).default([]),
  exclusions: z.array(shortText(160)).max(40).default([]),
  badge: z.string().trim().max(40).nullish(),
  isFeatured: z.boolean().default(false),
  mediaIds: mediaIdsSchema,
});

const productOptionValueInputSchema = z.object({
  id: z.string().trim().min(1).max(60),
  label: shortText(80),
  priceDelta: z.number().int(),
});

const productOptionInputSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: shortText(60),
  values: z.array(productOptionValueInputSchema).max(30),
});

export const productInputSchema = z.object({
  domainId: idSchema,
  categoryId: idSchema,
  name: shortText(160),
  shortDescription: z.string().trim().max(300).default(""),
  description: longText(4000).default(""),
  basePrice: z.number().int().min(0),
  priceUnit: z.enum([
    "per_piece",
    "per_sqft",
    "per_running_ft",
    "per_kg",
    "per_room",
    "per_project",
  ]),
  leadTimeDays: z.number().int().min(0).max(365).default(0),
  isCustomisable: z.boolean().default(true),
  specs: z.record(z.string(), z.string()).default({}),
  options: z.array(productOptionInputSchema).max(12).default([]),
  tags: z.array(shortText(40)).max(20).default([]),
  isFeatured: z.boolean().default(false),
  mediaIds: mediaIdsSchema,
});

export const invoiceStatusSchema = z.object({
  status: z.enum(["pending", "paid", "overdue", "waived", "cancelled"]),
  note: z.string().trim().max(1000).nullish(),
});

const idParam = z.object({ id: idSchema });

export const opsRoutes = {
  /* ---- the queue ---- */
  opsLeads: route({
    method: "GET",
    path: "/ops/leads",
    audience: "staff",
    query: leadQueueSchema,
    summary: "leads.view — paged",
  }),
  opsLead: route({ method: "GET", path: "/ops/leads/:id", audience: "staff", params: idParam }),
  opsTimeline: route({
    method: "GET",
    path: "/ops/leads/:id/timeline",
    audience: "staff",
    params: idParam,
  }),
  opsLeadProjects: route({
    method: "GET",
    path: "/ops/leads/:id/projects",
    audience: "staff",
    params: idParam,
  }),
  opsCallLog: route({
    method: "GET",
    path: "/ops/leads/:id/calls",
    audience: "staff",
    params: idParam,
  }),
  opsLogCall: route({
    method: "POST",
    path: "/ops/leads/:id/calls",
    audience: "staff",
    params: idParam,
    body: callLogSchema,
    summary: "leads.manage",
  }),

  /* ---- one service ---- */
  opsRelay: route({
    method: "GET",
    path: "/ops/services/:id/relay",
    audience: "staff",
    params: idParam,
  }),
  opsReplyToClient: route({
    method: "POST",
    path: "/ops/services/:id/relay/client",
    audience: "staff",
    params: idParam,
    body: relaySchema,
    summary: "leads.manage",
  }),
  opsRelayToVendors: route({
    method: "POST",
    path: "/ops/services/:id/relay/vendors",
    audience: "staff",
    params: idParam,
    body: relaySchema,
    summary: "leads.manage — one message to every assigned vendor",
  }),
  opsVendorPool: route({
    method: "GET",
    path: "/ops/services/:id/pool",
    audience: "staff",
    params: idParam,
  }),
  opsAssign: route({
    method: "POST",
    path: "/ops/services/:id/assign",
    audience: "staff",
    params: idParam,
    body: assignSchema,
    summary: "leads.manage",
  }),
  opsScheduleVisit: route({
    method: "POST",
    path: "/ops/services/:id/visits",
    audience: "staff",
    params: idParam,
    body: scheduleVisitSchema,
    summary: "leads.manage — releases the address to that vendor",
  }),
  opsVisitOutcome: route({
    method: "POST",
    path: "/ops/visits/:id/outcome",
    audience: "staff",
    params: idParam,
    body: visitOutcomeSchema,
    summary: "leads.manage",
  }),
  opsVisits: route({
    method: "GET",
    path: "/ops/visits",
    audience: "staff",
    query: z.object({}),
    summary: "leads.view — every visit, soonest first, for the site visits screen",
  }),

  /* ---- execution ---- */
  opsReviewProof: route({
    method: "POST",
    path: "/ops/projects/:id/stages/:stageId/review",
    audience: "staff",
    params: z.object({ id: idSchema, stageId: idSchema }),
    body: reviewProofSchema,
    summary: "leads.manage — the only thing that moves a customer's progress bar",
  }),

  /* ---- day and dashboards ---- */
  opsMyDay: route({ method: "GET", path: "/ops/my-day", audience: "staff", query: z.object({}) }),
  opsAttention: route({
    method: "GET",
    path: "/ops/attention",
    audience: "staff",
    query: z.object({}),
    summary: "leads.view — everything across the panel that is waiting on our team",
  }),
  opsSalesDashboard: route({
    method: "GET",
    path: "/ops/dashboard",
    audience: "staff",
    query: z.object({}),
  }),
  opsAdminDashboard: route({
    method: "GET",
    path: "/ops/reports",
    audience: "staff",
    query: z.object({}),
    summary: "reports.view",
  }),
  opsAgents: route({ method: "GET", path: "/ops/agents", audience: "staff", query: z.object({}) }),

  /* ---- vendors ---- */
  opsVendors: route({
    method: "GET",
    path: "/ops/vendors",
    audience: "staff",
    query: paginationSchema.extend({
      status: z.string().max(30).optional(),
      domain: slugSchema.optional(),
      city: idSchema.optional(),
      search: z.string().trim().max(120).optional(),
    }),
    summary: "vendors.view — paged",
  }),
  opsVendor: route({ method: "GET", path: "/ops/vendors/:id", audience: "staff", params: idParam }),
  opsVendorOnboarding: route({
    method: "GET",
    path: "/ops/vendors/:id/onboarding",
    audience: "staff",
    params: idParam,
  }),
  opsVendorVerification: route({
    method: "GET",
    path: "/ops/vendors/:id/verification",
    audience: "staff",
    params: idParam,
    summary: "vendors.view — the paperwork behind the verified tag",
  }),
  opsReviewSignedCopy: route({
    method: "POST",
    path: "/ops/vendors/:id/verification/signed-copy",
    audience: "staff",
    params: idParam,
    body: verificationReviewSchema,
    summary: "vendors.verify",
  }),
  opsReceiveHardcopy: route({
    method: "POST",
    path: "/ops/vendors/:id/verification/hardcopy",
    audience: "staff",
    params: idParam,
    body: receiveHardcopySchema,
    summary: "vendors.verify — the signed original is in our hands",
  }),
  opsReviewVendorDocument: route({
    method: "POST",
    path: "/ops/vendors/:id/verification/documents/:documentId",
    audience: "staff",
    params: z.object({ id: idSchema, documentId: idSchema }),
    body: verificationReviewSchema,
    summary: "vendors.verify",
  }),
  opsPartnerTerms: route({
    method: "GET",
    path: "/ops/partner-terms",
    audience: "staff",
    query: z.object({}),
    summary: "agreements.view",
  }),
  opsUpdatePartnerTerms: route({
    method: "PATCH",
    path: "/ops/partner-terms",
    audience: "staff",
    body: partnerTermsDocumentSchema,
    summary: "agreements.manage — the standard agreement PDF and where originals go",
  }),
  opsSetVendorStatus: route({
    method: "PATCH",
    path: "/ops/vendors/:id",
    audience: "staff",
    params: idParam,
    body: z.object({ status: z.enum(["pending", "verified", "suspended", "blacklisted"]) }),
    summary: "vendors.verify",
  }),
  /* ---------------- becoming a vendor ---------------- */

  opsProfessionalApplications: route({
    method: "GET",
    path: "/ops/professional-applications",
    audience: "staff",
    query: z.object({
      status: z
        .enum(["all", "submitted", "under_review", "changes_requested", "approved", "rejected"])
        .optional(),
    }),
    summary: "vendors.view — the queue of people asking to become vendors",
  }),
  opsProfessionalApplication: route({
    method: "GET",
    path: "/ops/professional-applications/:id",
    audience: "staff",
    params: idParam,
    summary: "vendors.view",
  }),
  /**
   * One endpoint for every decision, because they are one decision.
   *
   * Splitting approve and reject into two paths invites a third that forgets to
   * record who decided, and the reviewer's screen is a single set of buttons
   * either way. The discriminator is in the body.
   */
  opsDecideProfessionalApplication: route({
    method: "POST",
    path: "/ops/professional-applications/:id/decision",
    audience: "staff",
    params: idParam,
    body: z.discriminatedUnion("action", [
      z.object({ action: z.literal("start_review") }),
      z.object({ action: z.literal("request_changes"), note: longText(2000) }),
      z.object({ action: z.literal("reject"), note: longText(2000) }),
      z.object({
        action: z.literal("approve"),
        note: z.string().trim().max(2000).optional(),
        /** Omitted means every trade they asked for. */
        approvedDomainIds: z.array(idSchema).max(12).optional(),
        commissionPercentOverrides: z.record(idSchema, z.number().int().min(0).max(100)).optional(),
      }),
    ]),
    summary: "vendors.verify — approving creates the vendor",
  }),

  opsSetVendorDomain: route({
    method: "PATCH",
    path: "/ops/vendors/:id/domains/:domainId",
    audience: "staff",
    params: z.object({ id: idSchema, domainId: idSchema }),
    body: z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      commissionPercentOverride: z.number().int().min(0).max(50).nullish(),
    }),
    summary: "vendors.verify for status; commission.manage for the override",
  }),

  /* ---- money ---- */
  opsAgreements: route({
    method: "GET",
    path: "/ops/agreements",
    audience: "staff",
    query: paginationSchema,
    summary: "agreements.view — paged",
  }),
  opsInvoices: route({
    method: "GET",
    path: "/ops/invoices",
    audience: "staff",
    query: paginationSchema.extend({ status: z.string().max(20).optional() }),
    summary: "commission.view — paged",
  }),
  opsSetInvoiceStatus: route({
    method: "PATCH",
    path: "/ops/invoices/:id",
    audience: "staff",
    params: idParam,
    body: invoiceStatusSchema,
    summary: "commission.manage",
  }),

  /* ---- configuration ---- */
  opsDomains: route({
    method: "GET",
    path: "/ops/domains",
    audience: "staff",
    query: z.object({}),
  }),
  opsCreateDomain: route({
    method: "POST",
    path: "/ops/domains",
    audience: "staff",
    body: domainInputSchema,
    summary: "settings.manage",
  }),
  opsUpdateDomain: route({
    method: "PATCH",
    path: "/ops/domains/:id",
    audience: "staff",
    params: idParam,
    body: domainInputSchema.partial().extend({ isActive: z.boolean().optional() }),
    summary: "settings.manage",
  }),
  opsCategories: route({
    method: "GET",
    path: "/ops/categories",
    audience: "staff",
    query: z.object({ domain: idSchema.optional() }),
  }),
  opsCreateCategory: route({
    method: "POST",
    path: "/ops/categories",
    audience: "staff",
    body: categoryInputSchema,
    summary: "catalog.manage",
  }),
  opsUpdateCategory: route({
    method: "PATCH",
    path: "/ops/categories/:id",
    audience: "staff",
    params: idParam,
    body: categoryInputSchema.partial().extend({ isActive: z.boolean().optional() }),
    summary: "catalog.manage",
  }),

  opsPackages: route({
    method: "GET",
    path: "/ops/packages",
    audience: "staff",
    query: z.object({ domain: idSchema.optional() }),
  }),
  opsCreatePackage: route({
    method: "POST",
    path: "/ops/packages",
    audience: "staff",
    body: packageInputSchema,
    summary: "catalog.manage",
  }),
  opsUpdatePackage: route({
    method: "PATCH",
    path: "/ops/packages/:id",
    audience: "staff",
    params: idParam,
    body: packageInputSchema.partial().extend({ isActive: z.boolean().optional() }),
    summary: "catalog.manage",
  }),

  opsProducts: route({
    method: "GET",
    path: "/ops/products",
    audience: "staff",
    query: z.object({ domain: idSchema.optional(), category: idSchema.optional() }),
  }),
  opsCreateProduct: route({
    method: "POST",
    path: "/ops/products",
    audience: "staff",
    body: productInputSchema,
    summary: "catalog.manage",
  }),
  opsUpdateProduct: route({
    method: "PATCH",
    path: "/ops/products/:id",
    audience: "staff",
    params: idParam,
    body: productInputSchema.partial().extend({ isActive: z.boolean().optional() }),
    summary: "catalog.manage",
  }),

  opsDomainUsage: route({
    method: "GET",
    path: "/ops/domains/:id/usage",
    audience: "staff",
    params: idParam,
  }),

  /* ---- support ---- */
  opsTickets: route({
    method: "GET",
    path: "/ops/tickets",
    audience: "staff",
    query: paginationSchema.extend({ status: z.string().max(20).optional() }),
  }),
  opsReplyToTicket: route({
    method: "POST",
    path: "/ops/tickets/:id/replies",
    audience: "staff",
    params: idParam,
    body: z.object({ body: longText(4000) }),
  }),
  opsSetTicketStatus: route({
    method: "PATCH",
    path: "/ops/tickets/:id",
    audience: "staff",
    params: idParam,
    body: z.object({ status: z.enum(["open", "in_progress", "resolved", "closed"]) }),
  }),
} as const;
