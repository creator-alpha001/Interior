import { z } from "zod";
import {
  baseRecordSchema,
  dateOnlySchema,
  idSchema,
  mediaAssetSchema,
  rupeesSchema,
  timestampSchema,
} from "./common";

export const projectStatusSchema = z.enum([
  "not_started",
  "ongoing",
  "on_hold",
  "completed",
  "cancelled",
]);

export const milestoneVerificationSchema = z.enum([
  "not_started",
  "submitted",
  "approved",
  "rejected",
]);

export const projectMilestoneSchema = z.object({
  id: idSchema,
  title: z.string(),
  /** What this stage covers, so "proof" means the same thing to everyone. */
  description: z.string().nullable(),
  completedAt: timestampSchema.nullable(),
  /** Photos the vendor uploaded as evidence the stage is genuinely done. */
  proof: z.array(mediaAssetSchema),
  proofNote: z.string().nullable(),
  submittedAt: timestampSchema.nullable(),
  verification: milestoneVerificationSchema,
  verifiedAt: timestampSchema.nullable(),
  verifiedByUserId: idSchema.nullable(),
  /** Why it was sent back, shown to the vendor. */
  verifierNote: z.string().nullable(),
});

/**
 * One project per lead-domain, even under a combined agreement: a painting job
 * finishing does not mean the furniture job under the same contract has.
 */
export const projectSchema = baseRecordSchema.extend({
  id: idSchema,
  reference: z.string(),
  leadDomainId: idSchema,
  agreementId: idSchema,
  clientId: idSchema,
  professionalId: idSchema,
  quoteId: idSchema,
  value: rupeesSchema,
  /** Locked in at agreement signing from the vendor's rate for that domain. */
  commissionPercent: z.number(),
  commissionAmount: rupeesSchema,
  startDate: dateOnlySchema.nullable(),
  estimatedEndDate: dateOnlySchema.nullable(),
  actualEndDate: dateOnlySchema.nullable(),
  completionPercent: z.number(),
  status: projectStatusSchema,
  milestones: z.array(projectMilestoneSchema),
});

/**
 * Commission accrues on the agreed price at the moment the agreement is signed,
 * and is billed per agreement — a combined agreement produces one invoice.
 *
 * Cancellation default (admin-overridable): waived if cancelled before work
 * starts, retained in full once work has started.
 */
export const invoiceStatusSchema = z.enum([
  "pending",
  "paid",
  "overdue",
  "waived",
  "cancelled",
]);

export const commissionInvoiceSchema = baseRecordSchema.extend({
  id: idSchema,
  reference: z.string(),
  professionalId: idSchema,
  agreementId: idSchema,
  /** Sum of commission across every project under that agreement. */
  amount: rupeesSchema,
  status: invoiceStatusSchema,
  dueDate: dateOnlySchema,
  paidDate: dateOnlySchema.nullable(),
  /** Set when admin waives or adjusts the amount, with the reason. */
  adjustmentNote: z.string().nullable(),
});

/**
 * Ratings stay per project (therefore per domain) even under one combined
 * agreement — a client can rate the same vendor's painting and carpentry
 * differently, and that granularity feeds per-domain vendor ratings.
 */
export const reviewSchema = baseRecordSchema.extend({
  id: idSchema,
  projectId: idSchema,
  clientId: idSchema,
  professionalId: idSchema,
  domainId: idSchema,
  rating: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  comment: z.string(),
  /** Optional sub-scores shown on the vendor profile. */
  qualityRating: z.number().nullable(),
  timelinessRating: z.number().nullable(),
  professionalismRating: z.number().nullable(),
});

export const refundSchema = baseRecordSchema.extend({
  id: idSchema,
  projectId: idSchema,
  clientId: idSchema,
  amount: rupeesSchema,
  reason: z.string(),
  status: z.enum(["requested", "approved", "rejected", "processed"]),
  processedAt: timestampSchema.nullable(),
  handledByUserId: idSchema.nullable(),
});

export const ticketReplySchema = z.object({
  id: idSchema,
  authorRole: z.enum(["client", "platform"]),
  authorName: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const supportTicketSchema = baseRecordSchema.extend({
  id: idSchema,
  reference: z.string(),
  raisedByUserId: idSchema,
  leadId: idSchema.nullable(),
  projectId: idSchema.nullable(),
  category: z.enum(["complaint", "escalation", "refund", "query", "technical"]),
  subject: z.string(),
  body: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  assignedToUserId: idSchema.nullable(),
  replies: z.array(ticketReplySchema),
});
