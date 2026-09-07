import { z } from "zod";
import { baseRecordSchema, idSchema, rupeesSchema, timestampSchema } from "./common";

export const meetingStatusSchema = z.enum([
  "scheduled",
  "confirmed",
  "completed",
  "rescheduled",
  "no_show",
]);

export const meetingTypeSchema = z.enum([
  "consultation",
  "site_visit",
  "measurement",
  "handover",
]);

/**
 * Meetings hang off the lead-domain, not the lead, so a vendor serving two
 * domains of one lead has two distinguishable visits, and admin can filter
 * "this week's painting site visits" directly.
 *
 * Visits are always arranged by the platform: the coordinator confirms the slot
 * with both sides separately. Neither party books the other directly, and the
 * vendor receives the address only once the visit is confirmed.
 */
export const meetingSchema = baseRecordSchema.extend({
  id: idSchema,
  leadDomainId: idSchema,
  professionalId: idSchema,
  type: meetingTypeSchema,
  scheduledAt: timestampSchema,
  location: z.string(),
  status: meetingStatusSchema,
  notes: z.string().nullable(),
  /** Sales agent or ops user who arranged and confirmed this visit. */
  coordinatorId: idSchema.nullable(),
  /** Set when the site address was released to the vendor for this visit. */
  addressReleasedAt: timestampSchema.nullable(),
  /**
   * A client asking for a different slot. They cannot rebook directly — the
   * coordinator re-confirms with the professional and proposes a new time.
   */
  rescheduleRequestedAt: timestampSchema.nullable(),
  rescheduleNote: z.string().nullable(),
  /**
   * What the visit actually established — measurements taken, conditions found,
   * scope that changed. Optional, because not every visit produces news, but
   * when it does this is what stops the same question being asked twice and
   * what every vendor quoting the job should be working from.
   */
  outcome: z.string().nullable(),
  outcomeRecordedAt: timestampSchema.nullable(),
  /** Whether the visit changed the scope enough that quotes need revising. */
  outcomeChangedScope: z.boolean(),
});

export const quoteStatusSchema = z.enum([
  "draft",
  "submitted",
  "revised",
  "approved",
  "rejected",
  "selected",
]);

export const quoteLineItemSchema = z.object({
  id: idSchema,
  description: z.string(),
  quantity: z.number(),
  /** e.g. "sq.ft", "running ft", "piece", "kg" — differs by trade. */
  unit: z.string(),
  rate: rupeesSchema,
  amount: rupeesSchema,
});

/**
 * Always submitted against one domain of a lead, never the whole requirement,
 * so quotes stay cleanly comparable inside each domain's table.
 * Quotes are versioned — they get renegotiated, and the history matters.
 */
export const quoteSchema = baseRecordSchema.extend({
  id: idSchema,
  leadDomainId: idSchema,
  professionalId: idSchema,
  version: z.number().int(),
  /** Points at the quote this one supersedes. */
  supersedesQuoteId: idSchema.nullable(),
  lineItems: z.array(quoteLineItemSchema),
  subtotal: rupeesSchema,
  taxPercent: z.number(),
  taxAmount: rupeesSchema,
  total: rupeesSchema,
  timelineDays: z.number().int(),
  warrantyMonths: z.number().int(),
  warrantyDetails: z.string(),
  /** Free text describing brands/grades — captioned per domain in the UI. */
  materialsSummary: z.string(),
  boqUrl: z.string().nullable(),
  quotePdfUrl: z.string().nullable(),
  status: quoteStatusSchema,
  notes: z.string().nullable(),
});

/**
 * Clients and vendors never message each other directly.
 *
 * Every thread has the platform on one side of it: the client talks to us, we
 * talk to the vendor, and our team carries the substance across. That keeps the
 * relationship — and the commission — with the platform, and means a question
 * asked once can be put to all three vendors rather than only the one the
 * client happened to message.
 *
 * Threads are still scoped per lead-domain so multi-service conversations
 * never mix.
 */
export const messageChannelSchema = z.enum(["client_platform", "platform_vendor"]);

export const messageSenderRoleSchema = z.enum(["client", "platform", "professional"]);

export const messageSchema = baseRecordSchema.extend({
  id: idSchema,
  leadDomainId: idSchema,
  channel: messageChannelSchema,
  /** Which side wrote it. The platform is always the counterparty. */
  senderRole: messageSenderRoleSchema,
  senderId: idSchema,
  /**
   * Only set on the platform_vendor channel, identifying which vendor the
   * thread is with. A lead-domain has one client thread and one thread per
   * assigned vendor.
   */
  professionalId: idSchema.nullable(),
  body: z.string(),
  attachmentUrl: z.string().nullable(),
  readAt: timestampSchema.nullable(),
  /**
   * Set when our team relayed this message from the other side, so ops can see
   * what originated where without either party seeing the other's thread.
   */
  relayedFromMessageId: idSchema.nullable(),
});
