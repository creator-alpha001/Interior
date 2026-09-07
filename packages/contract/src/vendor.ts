/**
 * The vendor portal.
 *
 * As with `/me`, no path takes a professional id — it comes from the session.
 * And no response shape here has a field capable of carrying a customer's phone
 * number or email; see `MaskedClientSummary` in `@repo/types`.
 */
import { z } from "zod";
import {
  messageSchema as messageRecordSchema,
  partnerAgreementSchema,
  portfolioItemSchema,
  quoteSchema,
  vendorAgreementViewSchema,
  vendorDashboardSchema,
  vendorInvoiceViewSchema,
  vendorLeadCardSchema,
  vendorPerformanceSchema,
  vendorProjectViewSchema,
  vendorOnboardingSchema,
  vendorVisitViewSchema,
} from "@repo/types/schema";
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
    response: z.array(vendorLeadCardSchema),
  }),
  vendorLead: route({
    method: "GET",
    path: "/vendor/leads/:id",
    audience: "professional",
    params: idParam,
    response: vendorLeadCardSchema,
  }),
  respondToLead: route({
    method: "POST",
    path: "/vendor/leads/:id/respond",
    audience: "professional",
    params: idParam,
    body: respondSchema,
    response: vendorLeadCardSchema,
  }),
  submitQuote: route({
    method: "POST",
    path: "/vendor/leads/:id/quotes",
    audience: "professional",
    params: idParam,
    body: quoteDraftSchema,
    response: quoteSchema,
    successStatus: 201,
  }),
  vendorThread: route({
    method: "GET",
    path: "/vendor/leads/:id/messages",
    audience: "professional",
    params: idParam,
    response: z.array(messageRecordSchema),
  }),
  sendVendorMessage: route({
    method: "POST",
    path: "/vendor/leads/:id/messages",
    audience: "professional",
    params: idParam,
    body: messageSchema,
    response: messageRecordSchema,
    successStatus: 201,
  }),

  vendorDashboard: route({
    method: "GET",
    path: "/vendor/dashboard",
    audience: "professional",
    query: z.object({}),
    response: vendorDashboardSchema,
  }),
  vendorAgreements: route({
    method: "GET",
    path: "/vendor/agreements",
    audience: "professional",
    query: z.object({}),
    response: z.array(vendorAgreementViewSchema),
  }),
  vendorProjects: route({
    method: "GET",
    path: "/vendor/projects",
    audience: "professional",
    query: z.object({}),
    response: z.array(vendorProjectViewSchema),
  }),
  submitMilestoneProof: route({
    method: "POST",
    path: "/vendor/projects/:id/stages/:stageId/proof",
    audience: "professional",
    params: z.object({ id: idSchema, stageId: idSchema }),
    body: milestoneProofSchema,
    response: z.array(vendorProjectViewSchema),
  }),
  vendorInvoices: route({
    method: "GET",
    path: "/vendor/invoices",
    audience: "professional",
    query: z.object({}),
    response: z.array(vendorInvoiceViewSchema),
  }),
  vendorVisits: route({
    method: "GET",
    path: "/vendor/visits",
    audience: "professional",
    query: z.object({}),
    response: z.array(vendorVisitViewSchema),
  }),
  vendorPerformance: route({
    method: "GET",
    path: "/vendor/performance",
    audience: "professional",
    query: z.object({}),
    response: vendorPerformanceSchema,
  }),
  vendorPortfolio: route({
    method: "GET",
    path: "/vendor/portfolio",
    audience: "professional",
    query: z.object({}),
    response: z.array(portfolioItemSchema),
  }),

  vendorOnboarding: route({
    method: "GET",
    path: "/vendor/onboarding",
    audience: "professional",
    query: z.object({}),
    response: vendorOnboardingSchema,
  }),
  signPartnerAgreement: route({
    method: "POST",
    path: "/vendor/onboarding/agreement",
    audience: "professional",
    body: signPartnerAgreementSchema,
    response: partnerAgreementSchema,
    successStatus: 201,
  }),
} as const;
