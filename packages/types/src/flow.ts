/** Visits, quotes and the relayed message threads between the two sides. */
import type { z } from "zod";
import type {
  meetingSchema,
  meetingStatusSchema,
  meetingTypeSchema,
  messageChannelSchema,
  messageSchema,
  messageSenderRoleSchema,
  quoteLineItemSchema,
  quoteSchema,
  quoteStatusSchema,
} from "./schema/flow";

export type MeetingStatus = z.infer<typeof meetingStatusSchema>;

export type MeetingType = z.infer<typeof meetingTypeSchema>;

/**
 * Meetings hang off the lead-domain, not the lead, so a vendor serving two
 * domains of one lead has two distinguishable visits, and admin can filter
 * "this week's painting site visits" directly.
 *
 * Visits are always arranged by the platform: the coordinator confirms the slot
 * with both sides separately. Neither party books the other directly, and the
 * vendor receives the address only once the visit is confirmed.
 */
export type Meeting = z.infer<typeof meetingSchema>;

export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export type QuoteLineItem = z.infer<typeof quoteLineItemSchema>;

/**
 * Always submitted against one domain of a lead, never the whole requirement,
 * so quotes stay cleanly comparable inside each domain's table.
 * Quotes are versioned — they get renegotiated, and the history matters.
 */
export type Quote = z.infer<typeof quoteSchema>;

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
export type MessageChannel = z.infer<typeof messageChannelSchema>;

export type MessageSenderRole = z.infer<typeof messageSenderRoleSchema>;

export type Message = z.infer<typeof messageSchema>;
