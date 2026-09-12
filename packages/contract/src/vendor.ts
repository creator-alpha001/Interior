/**
 * The vendor portal.
 *
 * As with `/me`, no path takes a professional id — it comes from the session.
 * And no response shape here has a field capable of carrying a customer's phone
 * number or email; see `MaskedClientSummary` in `@repo/types`.
 */
import { z } from "zod";
import {
  citySchema,
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
  hardcopyMethodSchema,
  vendorDocumentKindSchema,
  vendorVerificationSchema,
  vendorAchievementKindSchema,
  vendorAchievementSchema,
} from "@repo/types/schema";
import { okSchema } from "./responses";
import { idSchema, mediaIdSchema, rupeesSchema, shortText } from "./common";
import { messageSchema } from "./customer";
import { route } from "./http";

export const leadFilterSchema = z.enum(["all", "new", "quoting", "won", "lost"]).default("all");

export const respondSchema = z.object({
  response: z.enum(["accepted", "rejected"]),
  reason: z.string().trim().max(500).optional(),
});

/** One priced line of a quote. The trade decides what `unit` means. */
export const quoteLineDraftSchema = z.object({
  description: shortText(300),
  quantity: z.number().positive().max(100_000),
  unit: shortText(30),
  rate: rupeesSchema,
});

export const quoteDraftSchema = z.object({
  lineItems: z
    .array(quoteLineDraftSchema)
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

/** Every page of the paper agreement, signed, photographed or scanned. */
export const submitSignedCopySchema = z.object({
  files: z.array(mediaIdSchema).min(1, "Upload every signed page").max(20),
  stampCertificateNumber: z.string().trim().max(60).nullish(),
});

/**
 * How the signed original is reaching us.
 *
 * A courier needs its name and a tracking number; that rule is enforced by the
 * API rather than here, because a refinement would stop this schema being
 * described to the mobile client as a plain object.
 */
export const reportHardcopySchema = z.object({
  method: hardcopyMethodSchema,
  courier: z.string().trim().max(80).nullish(),
  trackingNumber: z.string().trim().max(80).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export const submitVendorDocumentSchema = z.object({
  kind: vendorDocumentKindSchema,
  documentNumber: z.string().trim().max(40).nullish(),
  files: z.array(mediaIdSchema).min(1, "Attach the document").max(6),
});

/**
 * A completed job. Photos are `portfolio_item` uploads.
 *
 * Public as soon as it is posted — ops take things down rather than let them
 * through — so what arrives here is what a customer will read.
 */
export const portfolioDraftSchema = z.object({
  /** One of the trades the vendor is approved for. */
  domainId: idSchema,
  cityId: idSchema.nullish(),
  title: shortText(120),
  /** The one-line summary, in plain text. */
  description: z.string().trim().max(1000).default(""),
  /** Short lines a customer skims. Six is already more than anybody reads. */
  highlights: z.array(z.string().trim().max(80)).max(6).default([]),
  /**
   * The long description, as HTML from the editor. Sanitised by the API
   * before it is stored — see `lib/html.ts` — so the limit is generous
   * rather than exact: markup costs characters a reader never sees.
   */
  details: z.string().max(20000).default(""),
  media: z.array(mediaIdSchema).min(1, "Add at least one photo").max(10),
});

/** An award, certification, membership or press mention, posted for review. */
export const achievementDraftSchema = z.object({
  kind: vendorAchievementKindSchema,
  title: shortText(160),
  issuer: z.string().trim().max(160).default(""),
  year: z.number().int().min(1950).max(2100).nullish(),
  description: z.string().trim().max(1000).default(""),
  /** An optional photograph of the certificate or award. */
  media: z.array(mediaIdSchema).max(1).default([]),
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
  addPortfolioItem: route({
    method: "POST",
    path: "/vendor/portfolio",
    audience: "professional",
    body: portfolioDraftSchema,
    response: portfolioItemSchema,
    successStatus: 201,
  }),
  removePortfolioItem: route({
    method: "DELETE",
    path: "/vendor/portfolio/:id",
    audience: "professional",
    params: idParam,
    response: okSchema,
  }),
  vendorAchievements: route({
    method: "GET",
    path: "/vendor/achievements",
    audience: "professional",
    query: z.object({}),
    response: z.array(vendorAchievementSchema),
  }),
  addAchievement: route({
    method: "POST",
    path: "/vendor/achievements",
    audience: "professional",
    body: achievementDraftSchema,
    response: vendorAchievementSchema,
    successStatus: 201,
  }),
  removeAchievement: route({
    method: "DELETE",
    path: "/vendor/achievements/:id",
    audience: "professional",
    params: idParam,
    response: okSchema,
  }),

  /**
   * The districts this vendor covers, and the only way to change them.
   *
   * They were set once, when the application was approved, and nothing could
   * touch them afterwards — so a vendor who took on a second district had to
   * ask ops, and ops had no screen for it either. Leads reach a vendor through
   * exactly this list, so a stale one is lost work.
   */
  vendorServiceAreas: route({
    method: "GET",
    path: "/vendor/service-areas",
    audience: "professional",
    query: z.object({}),
    response: z.array(citySchema),
  }),
  setVendorServiceAreas: route({
    method: "PUT",
    path: "/vendor/service-areas",
    audience: "professional",
    body: z.object({
      /** Every district they cover. Sending fewer removes the rest. */
      cityIds: z.array(idSchema).min(1, "Choose at least one district").max(50),
    }),
    response: z.array(citySchema),
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

  /* ---- verification: the paperwork behind the verified tag ---- */
  vendorVerification: route({
    method: "GET",
    path: "/vendor/verification",
    audience: "professional",
    query: z.object({}),
    response: vendorVerificationSchema,
  }),
  submitSignedCopy: route({
    method: "POST",
    path: "/vendor/verification/signed-copy",
    audience: "professional",
    body: submitSignedCopySchema,
    response: vendorVerificationSchema,
  }),
  reportHardcopy: route({
    method: "POST",
    path: "/vendor/verification/hardcopy",
    audience: "professional",
    body: reportHardcopySchema,
    response: vendorVerificationSchema,
  }),
  submitVendorDocument: route({
    method: "POST",
    path: "/vendor/verification/documents",
    audience: "professional",
    body: submitVendorDocumentSchema,
    response: vendorVerificationSchema,
  }),
} as const;
