import type { BaseRecord, DateOnly, ID, MediaAsset, Rupees, Timestamp } from "./common";

export type ProjectStatus = "not_started" | "ongoing" | "on_hold" | "completed" | "cancelled";

/**
 * One project per lead-domain, even under a combined agreement: a painting job
 * finishing does not mean the furniture job under the same contract has.
 */
export interface Project extends BaseRecord {
  id: ID;
  reference: string;
  leadDomainId: ID;
  agreementId: ID;
  clientId: ID;
  professionalId: ID;
  quoteId: ID;
  value: Rupees;
  /** Locked in at agreement signing from the vendor's rate for that domain. */
  commissionPercent: number;
  commissionAmount: Rupees;
  startDate: DateOnly | null;
  estimatedEndDate: DateOnly | null;
  actualEndDate: DateOnly | null;
  completionPercent: number;
  status: ProjectStatus;
  milestones: ProjectMilestone[];
}

export type MilestoneVerification =
  | "not_started"
  | "submitted"
  | "approved"
  | "rejected";

export interface ProjectMilestone {
  id: ID;
  title: string;
  /** What this stage covers, so "proof" means the same thing to everyone. */
  description: string | null;
  completedAt: Timestamp | null;
  /** Photos the vendor uploaded as evidence the stage is genuinely done. */
  proof: MediaAsset[];
  proofNote: string | null;
  submittedAt: Timestamp | null;
  verification: MilestoneVerification;
  verifiedAt: Timestamp | null;
  verifiedByUserId: ID | null;
  /** Why it was sent back, shown to the vendor. */
  verifierNote: string | null;
}

/**
 * Commission accrues on the agreed price at the moment the agreement is signed,
 * and is billed per agreement — a combined agreement produces one invoice.
 *
 * Cancellation default (admin-overridable): waived if cancelled before work
 * starts, retained in full once work has started.
 */
export type InvoiceStatus = "pending" | "paid" | "overdue" | "waived" | "cancelled";

export interface CommissionInvoice extends BaseRecord {
  id: ID;
  reference: string;
  professionalId: ID;
  agreementId: ID;
  /** Sum of commission across every project under that agreement. */
  amount: Rupees;
  status: InvoiceStatus;
  dueDate: DateOnly;
  paidDate: DateOnly | null;
  /** Set when admin waives or adjusts the amount, with the reason. */
  adjustmentNote: string | null;
}

/**
 * Ratings stay per project (therefore per domain) even under one combined
 * agreement — a client can rate the same vendor's painting and carpentry
 * differently, and that granularity feeds per-domain vendor ratings.
 */
export interface Review extends BaseRecord {
  id: ID;
  projectId: ID;
  clientId: ID;
  professionalId: ID;
  domainId: ID;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  /** Optional sub-scores shown on the vendor profile. */
  qualityRating: number | null;
  timelinessRating: number | null;
  professionalismRating: number | null;
}

export interface Refund extends BaseRecord {
  id: ID;
  projectId: ID;
  clientId: ID;
  amount: Rupees;
  reason: string;
  status: "requested" | "approved" | "rejected" | "processed";
  processedAt: Timestamp | null;
  handledByUserId: ID | null;
}

export interface TicketReply {
  id: ID;
  authorRole: "client" | "platform";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface SupportTicket extends BaseRecord {
  id: ID;
  reference: string;
  raisedByUserId: ID;
  leadId: ID | null;
  projectId: ID | null;
  category: "complaint" | "escalation" | "refund" | "query" | "technical";
  subject: string;
  body: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedToUserId: ID | null;
  replies: TicketReply[];
}
