/**
 * The customer surface, and uploads.
 *
 * Every path here is under `/me`, and none of them takes a customer id. That is
 * not a style choice: the id comes from the session cookie, so a request cannot
 * reach another customer's requirements by changing a parameter.
 */
import { z } from "zod";
import { idSchema, longText, mediaIdSchema, rupeesSchema, shortText } from "./common";
import { route } from "./http";

/* ---------------- uploads ---------------- */

export const uploadPurposeSchema = z.enum([
  "requirement_photo",
  "milestone_proof",
  "portfolio_item",
  "vendor_document",
]);

export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

export const uploadTicketSchema = z.object({
  purpose: uploadPurposeSchema,
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(100),
  // Bounded here as well as by purpose, so a nonsense figure is rejected before
  // it reaches the per-purpose rule.
  sizeBytes: z.number().int().positive().max(50_000_000),
});

/* ---------------- requirements ---------------- */

export const materialSourceSchema = z.enum([
  "vendor_supplied",
  "customer_supplied",
  "undecided",
]);

export const requirementSchema = z
  .object({
    cityId: idSchema,
    domainIds: z.array(idSchema).min(1, "Choose at least one service").max(6),
    description: longText(4000),
    urgency: z.enum(["immediate", "within_month", "exploring"]),
    /** Asked once per selected service: who supplies the material. */
    materialSource: z.record(idSchema, materialSourceSchema).default({}),
    siteAccessibilityTags: z
      .array(z.enum(["parking", "lift", "timing_restriction", "other"]))
      .max(4)
      .optional(),
    budgetMin: rupeesSchema.nullish(),
    budgetMax: rupeesSchema.nullish(),
    /** A vendor asked for by name. Honoured only where they are approved. */
    preferredProfessionalId: idSchema.nullish(),
    photoIds: z.array(mediaIdSchema).max(6).optional(),
    catalogueItems: z
      .array(
        z.object({
          domainId: idSchema,
          productId: idSchema.optional(),
          packageId: idSchema.optional(),
          itemName: shortText(200),
          quantity: z.number().int().min(1).max(999),
          selectedOptions: z.record(z.string().max(60), z.string().max(120)).optional(),
          indicativePrice: rupeesSchema.nullish(),
          notes: z.string().trim().max(1000).nullish(),
        }),
      )
      .max(40)
      .optional(),
  })
  .refine(
    (value) =>
      value.budgetMin == null || value.budgetMax == null || value.budgetMin <= value.budgetMax,
    { message: "The lower budget must not exceed the upper one", path: ["budgetMin"] },
  );

export const reviewSchema = z.object({
  projectId: idSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(""),
  qualityRating: z.number().int().min(1).max(5).nullish(),
  timelinessRating: z.number().int().min(1).max(5).nullish(),
  professionalismRating: z.number().int().min(1).max(5).nullish(),
});

export const ticketSchema = z.object({
  category: z.enum(["complaint", "escalation", "refund", "query", "technical"]),
  subject: shortText(160),
  body: longText(4000),
  leadId: idSchema.nullish(),
  projectId: idSchema.nullish(),
});

export const messageSchema = z.object({ body: longText(2000) });
export const rescheduleSchema = z.object({ note: z.string().trim().max(500).default("") });

const idParam = z.object({ id: idSchema });

export const customerRoutes = {
  createUploadTicket: route({
    method: "POST",
    path: "/uploads/tickets",
    audience: "public",
    body: uploadTicketSchema,
    summary: "A short-lived URL to PUT one file straight at storage",
  }),

  listRequirements: route({
    method: "GET",
    path: "/me/requirements",
    audience: "client",
    query: z.object({}),
  }),
  getRequirement: route({
    method: "GET",
    path: "/me/requirements/:id",
    audience: "client",
    params: idParam,
  }),
  createRequirement: route({
    method: "POST",
    path: "/me/requirements",
    audience: "client",
    body: requirementSchema,
  }),

  listServiceMessages: route({
    method: "GET",
    path: "/me/services/:id/messages",
    audience: "client",
    params: idParam,
  }),
  sendServiceMessage: route({
    method: "POST",
    path: "/me/services/:id/messages",
    audience: "client",
    params: idParam,
    body: messageSchema,
  }),
  selectQuote: route({
    method: "POST",
    path: "/me/services/:id/select-quote",
    audience: "client",
    params: idParam,
    body: z.object({ quoteId: idSchema }),
  }),

  listAgreements: route({
    method: "GET",
    path: "/me/agreements",
    audience: "client",
    query: z.object({}),
  }),
  generateAgreements: route({
    method: "POST",
    path: "/me/requirements/:id/agreements",
    audience: "client",
    params: idParam,
    body: z.object({}),
  }),
  signAgreement: route({
    method: "POST",
    path: "/me/agreements/:id/sign",
    audience: "client",
    params: idParam,
    body: z.object({}),
  }),

  listProjects: route({
    method: "GET",
    path: "/me/projects",
    audience: "client",
    query: z.object({}),
  }),
  submitReview: route({
    method: "POST",
    path: "/me/reviews",
    audience: "client",
    body: reviewSchema,
  }),
  requestReschedule: route({
    method: "POST",
    path: "/me/visits/:id/reschedule",
    audience: "client",
    params: idParam,
    body: rescheduleSchema,
  }),

  listNotifications: route({
    method: "GET",
    path: "/me/notifications",
    audience: "client",
    query: z.object({}),
  }),
  markNotificationsRead: route({
    method: "POST",
    path: "/me/notifications/read",
    audience: "client",
    body: z.object({}),
  }),

  listTickets: route({
    method: "GET",
    path: "/me/tickets",
    audience: "client",
    query: z.object({}),
  }),
  createTicket: route({
    method: "POST",
    path: "/me/tickets",
    audience: "client",
    body: ticketSchema,
  }),
  replyToTicket: route({
    method: "POST",
    path: "/me/tickets/:id/replies",
    audience: "client",
    params: idParam,
    body: messageSchema,
  }),

  referrals: route({
    method: "GET",
    path: "/me/referrals",
    audience: "client",
    query: z.object({}),
  }),
} as const;
