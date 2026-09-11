/**
 * The customer surface, and uploads.
 *
 * Every path here is under `/me`, and none of them takes a customer id. That is
 * not a style choice: the id comes from the session cookie, so a request cannot
 * reach another customer's requirements by changing a parameter.
 */
import { z } from "zod";
import {
  agreementSchema as agreementRecordSchema,
  agreementViewSchema,
  leadViewSchema,
  meetingSchema as meetingRecordSchema,
  messageSchema as messageRecordSchema,
  notificationSchema,
  professionalApplicationViewSchema,
  projectViewSchema,
  reviewSchema as reviewRecordSchema,
  supportTicketSchema,
  ticketReplySchema,
} from "@repo/types/schema";
import { idSchema, longText, mediaIdSchema, rupeesSchema, shortText } from "./common";
import {
  countSchema,
  referralSummarySchema,
  uploadTicketSchema as uploadTicketResponseSchema,
} from "./responses";
import { route } from "./http";

/* ---------------- uploads ---------------- */

export const uploadPurposeSchema = z.enum([
  "requirement_photo",
  "milestone_proof",
  "portfolio_item",
  "vendor_document",
  /**
   * The standard partner agreement PDF vendors print and sign. Staff only,
   * enforced in `createUploadTicket`.
   */
  "agreement_template",
  /**
   * A picture of a product, package, category or trade, uploaded by staff.
   *
   * `upload_purpose` in the database has listed this since the first migration
   * and this enum never did, so nothing could ask for a ticket for one. That is
   * the whole reason every catalogue card in the product renders a gradient:
   * not a display decision, an upload that could not be started.
   *
   * Staff only, enforced in `createUploadTicket` — see the note there about why
   * "signed in" was not a sufficient check once this existed.
   */
  "catalogue_image",
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

/**
 * One catalogue item the customer picked, carried into the requirement.
 *
 * Named rather than inline so the generated client calls it
 * `CatalogueSelection` instead of `CatalogueItems`.
 */
export const catalogueSelectionSchema = z.object({
  domainId: idSchema,
  productId: idSchema.optional(),
  packageId: idSchema.optional(),
  itemName: shortText(200),
  quantity: z.number().int().min(1).max(999),
  selectedOptions: z.record(z.string().max(60), z.string().max(120)).optional(),
  indicativePrice: rupeesSchema.nullish(),
  notes: z.string().trim().max(1000).nullish(),
});

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
    catalogueItems: z.array(catalogueSelectionSchema).max(40).optional(),
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

/**
 * What somebody has to say to be considered as a vendor.
 *
 * Deliberately short. Documents, work photographs, references and bank details
 * are collected by `/partner/onboarding`, which already exists and already
 * gates lead delivery on them — asking for all of it before a human has even
 * looked at the business would lose most applicants at a form, to no purpose.
 * This is what a reviewer needs in order to decide whether to go further.
 */
export const professionalApplicationInputSchema = z.object({
  companyName: shortText(160),
  /** Optional, and honestly so: smaller workshops are not registered. */
  gstNumber: z.string().trim().max(20).nullish(),
  experienceYears: z.number().int().min(0).max(70),
  bio: longText(2000),
  contactName: shortText(120),
  /** Falls back to the number on the account when it is left out. */
  contactMobile: z.string().trim().max(20).nullish(),
  requestedDomainIds: z.array(idSchema).min(1).max(12),
  serviceCityIds: z.array(idSchema).min(1).max(20),
  serviceAreaNote: z.string().trim().max(1000).default(""),
});

const idParam = z.object({ id: idSchema });

export const customerRoutes = {
  createUploadTicket: route({
    method: "POST",
    path: "/uploads/tickets",
    audience: "public",
    body: uploadTicketSchema,
    summary: "A short-lived URL to PUT one file straight at storage",
    response: uploadTicketResponseSchema,
  }),

  listRequirements: route({
    method: "GET",
    path: "/me/requirements",
    audience: "client",
    query: z.object({}),
    response: z.array(leadViewSchema),
  }),
  getRequirement: route({
    method: "GET",
    path: "/me/requirements/:id",
    audience: "client",
    params: idParam,
    response: leadViewSchema,
  }),
  createRequirement: route({
    method: "POST",
    path: "/me/requirements",
    audience: "client",
    body: requirementSchema,
    response: leadViewSchema,
    successStatus: 201,
  }),

  listServiceMessages: route({
    method: "GET",
    path: "/me/services/:id/messages",
    audience: "client",
    params: idParam,
    response: z.array(messageRecordSchema),
  }),
  sendServiceMessage: route({
    method: "POST",
    path: "/me/services/:id/messages",
    audience: "client",
    params: idParam,
    body: messageSchema,
    response: messageRecordSchema,
    successStatus: 201,
  }),
  selectQuote: route({
    method: "POST",
    path: "/me/services/:id/select-quote",
    audience: "client",
    params: idParam,
    body: z.object({ quoteId: idSchema }),
    response: leadViewSchema,
  }),

  listAgreements: route({
    method: "GET",
    path: "/me/agreements",
    audience: "client",
    query: z.object({}),
    response: z.array(agreementViewSchema),
  }),
  generateAgreements: route({
    method: "POST",
    path: "/me/requirements/:id/agreements",
    audience: "client",
    params: idParam,
    body: z.object({}),
    response: z.array(agreementViewSchema),
  }),
  signAgreement: route({
    method: "POST",
    path: "/me/agreements/:id/sign",
    audience: "client",
    params: idParam,
    body: z.object({}),
    response: agreementRecordSchema,
  }),

  listProjects: route({
    method: "GET",
    path: "/me/projects",
    audience: "client",
    query: z.object({}),
    response: z.array(projectViewSchema),
  }),
  submitReview: route({
    method: "POST",
    path: "/me/reviews",
    audience: "client",
    body: reviewSchema,
    response: reviewRecordSchema,
    successStatus: 201,
  }),
  requestReschedule: route({
    method: "POST",
    path: "/me/visits/:id/reschedule",
    audience: "client",
    params: idParam,
    body: rescheduleSchema,
    response: meetingRecordSchema,
  }),

  listNotifications: route({
    method: "GET",
    path: "/me/notifications",
    audience: "client",
    query: z.object({}),
    response: z.array(notificationSchema),
  }),
  markNotificationsRead: route({
    method: "POST",
    path: "/me/notifications/read",
    audience: "client",
    body: z.object({}),
    response: countSchema,
  }),

  listTickets: route({
    method: "GET",
    path: "/me/tickets",
    audience: "client",
    query: z.object({}),
    response: z.array(supportTicketSchema),
  }),
  createTicket: route({
    method: "POST",
    path: "/me/tickets",
    audience: "client",
    body: ticketSchema,
    response: supportTicketSchema,
    successStatus: 201,
  }),
  replyToTicket: route({
    method: "POST",
    path: "/me/tickets/:id/replies",
    audience: "client",
    params: idParam,
    body: messageSchema,
    response: ticketReplySchema,
    successStatus: 201,
  }),

  /* ---------------- becoming a vendor ---------------- */

  /**
   * Null until they have ever applied, rather than a 404.
   *
   * "You have no application" is a perfectly good answer to this question and
   * the screen renders it — an error status would make the ordinary case look
   * like a failure to every client that checks one.
   */
  myProfessionalApplication: route({
    method: "GET",
    path: "/me/professional-application",
    audience: "client",
    query: z.object({}),
    response: professionalApplicationViewSchema.nullable(),
  }),
  submitProfessionalApplication: route({
    method: "POST",
    path: "/me/professional-application",
    audience: "client",
    body: professionalApplicationInputSchema,
    response: professionalApplicationViewSchema,
    successStatus: 201,
  }),
  withdrawProfessionalApplication: route({
    method: "DELETE",
    path: "/me/professional-application",
    audience: "client",
    response: professionalApplicationViewSchema.nullable(),
  }),

  referrals: route({
    method: "GET",
    path: "/me/referrals",
    audience: "client",
    query: z.object({}),
    response: referralSummarySchema,
  }),
} as const;
