/**
 * The ops panel.
 *
 * Requires a staff session, and most routes additionally require a permission —
 * an operations manager works leads all day and should not be able to change a
 * commission rate. The permission each one needs is named beside it.
 */
import { z } from "zod";
import { idSchema, longText, paginationSchema, shortText, slugSchema } from "./common";
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

export const relaySchema = z.object({
  body: longText(2000),
  /** The message being carried across, so ops can see what came from where. */
  sourceMessageId: idSchema.optional(),
});

export const reviewProofSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(1000).nullish(),
});

export const domainInputSchema = z.object({
  name: shortText(80),
  tagline: z.string().trim().max(200).default(""),
  description: z.string().trim().max(2000).default(""),
  defaultCommissionPercent: z.number().int().min(0).max(50),
  labels: z.object({
    materials: shortText(80),
    warranty: shortText(80),
    pricingBasis: shortText(120),
  }),
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
  opsSetVendorStatus: route({
    method: "PATCH",
    path: "/ops/vendors/:id",
    audience: "staff",
    params: idParam,
    body: z.object({ status: z.enum(["pending", "verified", "suspended", "blacklisted"]) }),
    summary: "vendors.verify",
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
