/**
 * Delivery: projects, the stages they are checked against, commission, reviews.
 *
 * The rule that shapes this file: a stage is done when somebody *checked*, not
 * when somebody said so. Vendors submit photographs; ops approve them; only an
 * approval moves the completion the customer sees.
 */
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { clients, professionals, users } from "./identity";
import { domains } from "./domains";
import { leadDomains, leads } from "./leads";
import { quotes } from "./flow";
import { agreements } from "./agreements";
import {
  invoiceStatus,
  milestoneVerification,
  projectStatus,
  refundStatus,
  ticketAuthorRole,
  ticketCategory,
  ticketPriority,
  ticketStatus,
} from "./enums";

/**
 * One project per service, even under a combined agreement — a painting job
 * finishing does not mean the furniture job under the same contract has.
 */
export const projects = pgTable(
  "projects",
  {
    id: primaryId(),
    reference: varchar("reference", { length: 40 }).notNull(),
    leadDomainId: fk("lead_domain_id")
      .notNull()
      .references(() => leadDomains.id),
    agreementId: fk("agreement_id")
      .notNull()
      .references(() => agreements.id),
    clientId: fk("client_id")
      .notNull()
      .references(() => clients.id),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id),
    quoteId: fk("quote_id")
      .notNull()
      .references(() => quotes.id),
    value: integer("value").notNull(),
    /**
     * Frozen at signing from the vendor's rate for that trade. A later override
     * or a change to the domain default must not retro-apply to work already
     * contracted.
     */
    commissionPercent: integer("commission_percent").notNull(),
    commissionAmount: integer("commission_amount").notNull(),
    startDate: date("start_date"),
    estimatedEndDate: date("estimated_end_date"),
    actualEndDate: date("actual_end_date"),
    /**
     * Derived from approved milestones only, and written by exactly one code
     * path. The vendor-facing `updateProjectProgress` that also wrote it has
     * been removed — it let a vendor declare themselves finished.
     */
    completionPercent: smallint("completion_percent").notNull().default(0),
    status: projectStatus("status").notNull().default("not_started"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_project_reference").on(t.reference),
    // One project per service. Signing twice must not duplicate the work.
    uniqueIndex("uq_project_lead_domain").on(t.leadDomainId),
    index("ix_project_professional").on(t.professionalId, t.status),
    index("ix_project_client").on(t.clientId, t.createdAt),
    index("ix_project_agreement").on(t.agreementId),
  ],
);

/**
 * A real table rather than a JSON array on the project.
 *
 * Milestones are addressed individually by id, carry their own verification
 * workflow and audit fields, and are written concurrently by the vendor
 * submitting proof and ops approving it. That is three reasons a JSON blob
 * would be the wrong shape.
 */
export const projectMilestones = pgTable(
  "project_milestones",
  {
    id: primaryId(),
    projectId: fk("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sortOrder: smallint("sort_order").notNull(),
    title: text("title").notNull(),
    /** What the stage covers, so "proof" means the same thing to both sides. */
    description: text("description"),
    completedAt: ts("completed_at"),
    proofNote: text("proof_note"),
    submittedAt: ts("submitted_at"),
    verification: milestoneVerification("verification").notNull().default("not_started"),
    verifiedAt: ts("verified_at"),
    verifiedByUserId: fk("verified_by_user_id").references(() => users.id),
    /** Why it was sent back, shown to the vendor. */
    verifierNote: text("verifier_note"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_milestone_order").on(t.projectId, t.sortOrder),
    index("ix_milestone_project").on(t.projectId),
    // Drives the ops review queue.
    index("ix_milestone_submitted")
      .on(t.verification, t.submittedAt)
      .where(sql`${t.verification} = 'submitted'`),
  ],
);

/**
 * Commission accrues on the agreed price the moment the agreement is signed,
 * and is billed per agreement — so a combined agreement produces one invoice.
 */
export const commissionInvoices = pgTable(
  "commission_invoices",
  {
    id: primaryId(),
    reference: varchar("reference", { length: 32 }).notNull(),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id),
    agreementId: fk("agreement_id")
      .notNull()
      .references(() => agreements.id),
    /** Sum of commission across every project under that agreement. */
    amount: integer("amount").notNull(),
    status: invoiceStatus("status").notNull().default("pending"),
    dueDate: date("due_date").notNull(),
    paidDate: date("paid_date"),
    /** Set when admin waives or adjusts, with the reason. */
    adjustmentNote: text("adjustment_note"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_invoice_reference").on(t.reference),
    // One invoice per agreement — billing the same contract twice is the worst
    // failure mode this schema can have.
    uniqueIndex("uq_invoice_agreement").on(t.agreementId),
    index("ix_invoice_professional").on(t.professionalId, t.status),
    // Drives the nightly overdue sweep and the commission dashboard.
    index("ix_invoice_due").on(t.status, t.dueDate),
  ],
);

/**
 * Reviews stay per project, therefore per trade, even under one combined
 * agreement — a client can rate the same vendor's painting and carpentry
 * differently, and that granularity is what feeds per-trade ratings.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: primaryId(),
    projectId: fk("project_id")
      .notNull()
      .references(() => projects.id),
    clientId: fk("client_id")
      .notNull()
      .references(() => clients.id),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id),
    domainId: fk("domain_id")
      .notNull()
      .references(() => domains.id),
    rating: smallint("rating").notNull(),
    comment: text("comment").notNull().default(""),
    qualityRating: smallint("quality_rating"),
    timelinessRating: smallint("timeliness_rating"),
    professionalismRating: smallint("professionalism_rating"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_review_project").on(t.projectId),
    index("ix_review_professional").on(t.professionalId, t.createdAt),
    index("ix_review_professional_domain").on(t.professionalId, t.domainId),
    check("ck_review_rating", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

export const refunds = pgTable(
  "refunds",
  {
    id: primaryId(),
    projectId: fk("project_id")
      .notNull()
      .references(() => projects.id),
    clientId: fk("client_id")
      .notNull()
      .references(() => clients.id),
    amount: integer("amount").notNull(),
    reason: text("reason").notNull(),
    status: refundStatus("status").notNull().default("requested"),
    processedAt: ts("processed_at"),
    handledByUserId: fk("handled_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [index("ix_refund_project").on(t.projectId)],
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: primaryId(),
    reference: varchar("reference", { length: 32 }).notNull(),
    raisedByUserId: fk("raised_by_user_id")
      .notNull()
      .references(() => users.id),
    leadId: fk("lead_id").references(() => leads.id),
    projectId: fk("project_id").references(() => projects.id),
    category: ticketCategory("category").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    priority: ticketPriority("priority").notNull().default("medium"),
    status: ticketStatus("status").notNull().default("open"),
    assignedToUserId: fk("assigned_to_user_id").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("uq_ticket_reference").on(t.reference),
    index("ix_ticket_raiser").on(t.raisedByUserId, t.createdAt),
    index("ix_ticket_queue").on(t.status, t.priority, t.createdAt),
  ],
);

/** Append-only and ordered, so a table rather than a JSON array. */
export const ticketReplies = pgTable(
  "ticket_replies",
  {
    id: primaryId(),
    ticketId: fk("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    /** Taken from the session, never from the request body. */
    authorRole: ticketAuthorRole("author_role").notNull(),
    authorUserId: fk("author_user_id").references(() => users.id),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ix_ticket_reply").on(t.ticketId, t.createdAt)],
);
