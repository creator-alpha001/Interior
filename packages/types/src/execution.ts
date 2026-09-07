/** Projects, the stages they are checked against, commission and support. */
import type { z } from "zod";
import type {
  commissionInvoiceSchema,
  invoiceStatusSchema,
  milestoneVerificationSchema,
  projectMilestoneSchema,
  projectSchema,
  projectStatusSchema,
  refundSchema,
  reviewSchema,
  supportTicketSchema,
  ticketReplySchema,
} from "./schema/execution";

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/**
 * One project per lead-domain, even under a combined agreement: a painting job
 * finishing does not mean the furniture job under the same contract has.
 */
export type Project = z.infer<typeof projectSchema>;

export type MilestoneVerification = z.infer<typeof milestoneVerificationSchema>;

export type ProjectMilestone = z.infer<typeof projectMilestoneSchema>;

/**
 * Commission accrues on the agreed price at the moment the agreement is signed,
 * and is billed per agreement — a combined agreement produces one invoice.
 *
 * Cancellation default (admin-overridable): waived if cancelled before work
 * starts, retained in full once work has started.
 */
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export type CommissionInvoice = z.infer<typeof commissionInvoiceSchema>;

/**
 * Ratings stay per project (therefore per domain) even under one combined
 * agreement — a client can rate the same vendor's painting and carpentry
 * differently, and that granularity feeds per-domain vendor ratings.
 */
export type Review = z.infer<typeof reviewSchema>;

export type Refund = z.infer<typeof refundSchema>;

export type TicketReply = z.infer<typeof ticketReplySchema>;

export type SupportTicket = z.infer<typeof supportTicketSchema>;
