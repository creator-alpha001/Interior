/**
 * Visits, quotes and messages — everything between assignment and a signature.
 *
 * The rule this file exists to hold: customers and vendors never contact each
 * other. Every thread has the platform on one side of it, and the constraint at
 * the bottom of `messages` makes that structural rather than a convention the
 * next feature can forget.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { QuoteLineItem } from "@repo/types";
import { fk, primaryId, timestamps, ts } from "./_shared";
import { professionals, salesAgents, users } from "./identity";
import { leadDomains } from "./leads";
import {
  meetingStatus,
  meetingType,
  messageChannel,
  messageSenderRole,
  quoteStatus,
} from "./enums";

/**
 * Meetings hang off the lead-domain, not the lead, so a vendor working two
 * services of one requirement has two distinguishable visits and ops can filter
 * "this week's painting site visits" directly.
 */
export const meetings = pgTable(
  "meetings",
  {
    id: primaryId(),
    leadDomainId: fk("lead_domain_id")
      .notNull()
      .references(() => leadDomains.id, { onDelete: "cascade" }),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id),
    type: meetingType("type").notNull(),
    scheduledAt: ts("scheduled_at").notNull(),
    location: text("location").notNull(),
    status: meetingStatus("status").notNull().default("scheduled"),
    notes: text("notes"),
    /** The ops user who arranged and confirmed the slot with both sides. */
    coordinatorId: fk("coordinator_id").references(() => salesAgents.id),
    /**
     * When the site address was released to the vendor. This column is the sole
     * authority for whether a vendor may see the full address — the masking
     * query reads it, nothing else does.
     */
    addressReleasedAt: ts("address_released_at"),
    /** A client asking for a different slot. They cannot rebook directly. */
    rescheduleRequestedAt: ts("reschedule_requested_at"),
    rescheduleNote: text("reschedule_note"),
    /** What the visit established — measurements, conditions, changed scope. */
    outcome: text("outcome"),
    outcomeRecordedAt: ts("outcome_recorded_at"),
    outcomeChangedScope: boolean("outcome_changed_scope").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("ix_meeting_lead_domain").on(t.leadDomainId),
    index("ix_meeting_professional").on(t.professionalId, t.scheduledAt),
    index("ix_meeting_schedule").on(t.scheduledAt, t.status),
  ],
);

/**
 * Quotes are versioned because they get renegotiated, and the history is what
 * lets ops see how a price moved and why.
 */
export const quotes = pgTable(
  "quotes",
  {
    id: primaryId(),
    leadDomainId: fk("lead_domain_id")
      .notNull()
      .references(() => leadDomains.id, { onDelete: "cascade" }),
    professionalId: fk("professional_id")
      .notNull()
      .references(() => professionals.id),
    version: integer("version").notNull().default(1),
    supersedesQuoteId: fk("supersedes_quote_id"),
    /** Read and written whole with the quote, never queried into. */
    lineItems: jsonb("line_items").$type<QuoteLineItem[]>().notNull().default([]),
    subtotal: integer("subtotal").notNull(),
    taxPercent: integer("tax_percent").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    total: integer("total").notNull(),
    timelineDays: integer("timeline_days").notNull(),
    warrantyMonths: integer("warranty_months").notNull().default(0),
    warrantyDetails: text("warranty_details").notNull().default(""),
    materialsSummary: text("materials_summary").notNull().default(""),
    boqUrl: text("boq_url"),
    quotePdfUrl: text("quote_pdf_url"),
    status: quoteStatus("status").notNull().default("submitted"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    // Versions are dense and monotonic per vendor per service. Without this,
    // two concurrent submissions both read "latest = 1" and both write 2.
    uniqueIndex("uq_quote_version").on(t.leadDomainId, t.professionalId, t.version),
    // At most one live quote per vendor per service.
    uniqueIndex("uq_quote_live")
      .on(t.leadDomainId, t.professionalId)
      .where(sql`${t.status} NOT IN ('revised', 'rejected')`),
    // Target of the composite FK from lead_domains.selected_quote_id, which is
    // what stops a quote from another service being selected.
    uniqueIndex("uq_quote_id_lead_domain").on(t.id, t.leadDomainId),
    index("ix_quote_lead_domain").on(t.leadDomainId, t.total),
    index("ix_quote_professional").on(t.professionalId, t.createdAt),
  ],
);

/**
 * One client thread per service, and one vendor thread per assigned vendor.
 *
 * The platform is always the counterparty. That keeps the relationship — and
 * the commission — with the platform, and means a question asked once can be
 * put to all three vendors rather than only the one the client messaged.
 */
export const messages = pgTable(
  "messages",
  {
    id: primaryId(),
    leadDomainId: fk("lead_domain_id")
      .notNull()
      .references(() => leadDomains.id, { onDelete: "cascade" }),
    channel: messageChannel("channel").notNull(),
    senderRole: messageSenderRole("sender_role").notNull(),
    senderId: fk("sender_id").notNull(),
    /**
     * Which vendor the thread is with. Set on platform_vendor, null on
     * client_platform — enforced by the check below.
     */
    professionalId: fk("professional_id").references(() => professionals.id),
    body: text("body").notNull(),
    attachmentUrl: text("attachment_url"),
    readAt: ts("read_at"),
    /** Set when our team carried this across from the other side. */
    relayedFromMessageId: fk("relayed_from_message_id"),
    ...timestamps,
  },
  (t) => [
    index("ix_message_thread").on(t.leadDomainId, t.channel, t.professionalId, t.createdAt),
    index("ix_message_unread")
      .on(t.leadDomainId, t.readAt)
      .where(sql`${t.readAt} IS NULL`),
    /**
     * The firewall, as a constraint.
     *
     * A client message can never carry a professional id, and a vendor can
     * never write into the client thread. Enforcing this in code alone means
     * one careless insert leaks a vendor's words straight to the customer.
     */
    check(
      "ck_message_channel",
      sql`(${t.channel} = 'client_platform' AND ${t.professionalId} IS NULL AND ${t.senderRole} IN ('client', 'platform'))
       OR (${t.channel} = 'platform_vendor' AND ${t.professionalId} IS NOT NULL AND ${t.senderRole} IN ('professional', 'platform'))`,
    ),
  ],
);
