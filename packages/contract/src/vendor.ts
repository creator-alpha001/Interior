/**
 * The vendor portal.
 *
 * As with `/me`, no path takes a professional id — it comes from the session.
 * And no response shape here has a field capable of carrying a customer's phone
 * number or email; see `MaskedClientSummary` in `@repo/types`.
 */
import { z } from "zod";
import { idSchema, mediaIdSchema, rupeesSchema, shortText } from "./common";
import { messageSchema } from "./customer";
import { route } from "./http";

export const leadFilterSchema = z.enum(["all", "new", "quoting", "won", "lost"]).default("all");

export const respondSchema = z.object({
  response: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().max(500).optional(),
});

export const quoteDraftSchema = z.object({
  lineItems: z
    .array(
      z.object({
        description: shortText(300),
        quantity: z.number().positive().max(100_000),
        unit: shortText(30),
        rate: rupeesSchema,
      }),
    )
    .min(1, "A quote needs at least one line")
    .max(60),
  taxPercent: z.number().min(0).max(50),
  timelineDays: z.number().int().min(1).max(730),
  warrantyMonths: z.number().int().min(0).max(240),
  warrantyDetails: z.string().trim().max(1000).default(""),
  materialsSummary: z.string().trim().max(2000).default(""),
  notes: z.string().trim().max(2000).nullish(),
});

export const milestoneProofSchema = z.object({
  note: shortText(1000),
  proof: z.array(mediaIdSchema).min(1, "At least one photograph is required").max(8),
});

export const signPartnerAgreementSchema = z.object({
  signatoryName: shortText(120),
  signatoryRole: shortText(80),
  /** Typed, and stored exactly as entered. */
  signatureText: z.string().trim().min(3).max(120),
  acknowledgedClauses: z.array(z.string().max(60)).min(1),
});

const idParam = z.object({ id: idSchema });

export const vendorRoutes = {
  vendorLeads: route({
    method: "GET",
    path: "/vendor/leads",
    audience: "professional",
    query: z.object({ filter: leadFilterSchema }),
  }),
  vendorLead: route({
    method: "GET",
    path: "/vendor/leads/:id",
    audience: "professional",
    params: idParam,
  }),
  respondToLead: route({
    method: "POST",
    path: "/vendor/leads/:id/respond",
    audience: "professional",
    params: idParam,
    body: respondSchema,
  }),
  submitQuote: route({
    method: "POST",
    path: "/vendor/leads/:id/quotes",
    audience: "professional",
    params: idParam,
    body: quoteDraftSchema,
  }),
  vendorThread: route({
    method: "GET",
    path: "/vendor/leads/:id/messages",
    audience: "professional",
    params: idParam,
  }),
  sendVendorMessage: route({
    method: "POST",
    path: "/vendor/leads/:id/messages",
    audience: "professional",
    params: idParam,
    body: messageSchema,
  }),

  vendorDashboard: route({
    method: "GET",
    path: "/vendor/dashboard",
    audience: "professional",
    query: z.object({}),
  }),
  vendorAgreements: route({
    method: "GET",
    path: "/vendor/agreements",
    audience: "professional",
    query: z.object({}),
  }),
  vendorProjects: route({
    method: "GET",
    path: "/vendor/projects",
    audience: "professional",
    query: z.object({}),
  }),
  submitMilestoneProof: route({
    method: "POST",
    path: "/vendor/projects/:id/stages/:stageId/proof",
    audience: "professional",
    params: z.object({ id: idSchema, stageId: idSchema }),
    body: milestoneProofSchema,
  }),
  vendorInvoices: route({
    method: "GET",
    path: "/vendor/invoices",
    audience: "professional",
    query: z.object({}),
  }),
  vendorVisits: route({
    method: "GET",
    path: "/vendor/visits",
    audience: "professional",
    query: z.object({}),
  }),
  vendorPerformance: route({
    method: "GET",
    path: "/vendor/performance",
    audience: "professional",
    query: z.object({}),
  }),
  vendorPortfolio: route({
    method: "GET",
    path: "/vendor/portfolio",
    audience: "professional",
    query: z.object({}),
  }),

  vendorOnboarding: route({
    method: "GET",
    path: "/vendor/onboarding",
    audience: "professional",
    query: z.object({}),
  }),
  signPartnerAgreement: route({
    method: "POST",
    path: "/vendor/onboarding/agreement",
    audience: "professional",
    body: signPartnerAgreementSchema,
  }),
} as const;
