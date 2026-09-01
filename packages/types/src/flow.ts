import type { BaseRecord, ID, Rupees, Timestamp } from "./common";

export type MeetingStatus =
  | "scheduled"
  | "confirmed"
  | "completed"
  | "rescheduled"
  | "no_show";

export type MeetingType = "consultation" | "site_visit" | "measurement" | "handover";

/**
 * Meetings hang off the lead-domain, not the lead, so a vendor serving two
 * domains of one lead has two distinguishable visits, and admin can filter
 * "this week's painting site visits" directly.
 *
 * Visits are always arranged by the platform: the coordinator confirms the slot
 * with both sides separately. Neither party books the other directly, and the
 * vendor receives the address only once the visit is confirmed.
 */
export interface Meeting extends BaseRecord {
  id: ID;
  leadDomainId: ID;
  professionalId: ID;
  type: MeetingType;
  scheduledAt: Timestamp;
  location: string;
  status: MeetingStatus;
  notes: string | null;
  /** Sales agent or ops user who arranged and confirmed this visit. */
  coordinatorId: ID | null;
  /** Set when the site address was released to the vendor for this visit. */
  addressReleasedAt: Timestamp | null;
  /**
   * A client asking for a different slot. They cannot rebook directly — the
   * coordinator re-confirms with the professional and proposes a new time.
   */
  rescheduleRequestedAt: Timestamp | null;
  rescheduleNote: string | null;
  /**
   * What the visit actually established — measurements taken, conditions found,
   * scope that changed. Optional, because not every visit produces news, but
   * when it does this is what stops the same question being asked twice and
   * what every vendor quoting the job should be working from.
   */
  outcome: string | null;
  outcomeRecordedAt: Timestamp | null;
  /** Whether the visit changed the scope enough that quotes need revising. */
  outcomeChangedScope: boolean;
}

export type QuoteStatus =
  | "draft"
  | "submitted"
  | "revised"
  | "approved"
  | "rejected"
  | "selected";

export interface QuoteLineItem {
  id: ID;
  description: string;
  quantity: number;
  /** e.g. "sq.ft", "running ft", "piece", "kg" — differs by trade. */
  unit: string;
  rate: Rupees;
  amount: Rupees;
}

/**
 * Always submitted against one domain of a lead, never the whole requirement,
 * so quotes stay cleanly comparable inside each domain's table.
 * Quotes are versioned — they get renegotiated, and the history matters.
 */
export interface Quote extends BaseRecord {
  id: ID;
  leadDomainId: ID;
  professionalId: ID;
  version: number;
  /** Points at the quote this one supersedes. */
  supersedesQuoteId: ID | null;
  lineItems: QuoteLineItem[];
  subtotal: Rupees;
  taxPercent: number;
  taxAmount: Rupees;
  total: Rupees;
  timelineDays: number;
  warrantyMonths: number;
  warrantyDetails: string;
  /** Free text describing brands/grades — captioned per domain in the UI. */
  materialsSummary: string;
  boqUrl: string | null;
  quotePdfUrl: string | null;
  status: QuoteStatus;
  notes: string | null;
}

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
export type MessageChannel = "client_platform" | "platform_vendor";

export type MessageSenderRole = "client" | "platform" | "professional";

export interface Message extends BaseRecord {
  id: ID;
  leadDomainId: ID;
  channel: MessageChannel;
  /** Which side wrote it. The platform is always the counterparty. */
  senderRole: MessageSenderRole;
  senderId: ID;
  /**
   * Only set on the platform_vendor channel, identifying which vendor the
   * thread is with. A lead-domain has one client thread and one thread per
   * assigned vendor.
   */
  professionalId: ID | null;
  body: string;
  attachmentUrl: string | null;
  readAt: Timestamp | null;
  /**
   * Set when our team relayed this message from the other side, so ops can see
   * what originated where without either party seeing the other's thread.
   */
  relayedFromMessageId: ID | null;
}
