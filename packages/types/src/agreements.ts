import type { BaseRecord, DateOnly, ID, Rupees, Timestamp } from "./common";

export type AgreementStatus =
  | "draft"
  | "sent"
  | "signed"
  | "active"
  | "completed"
  | "cancelled";

/**
 * Agreements group by PROFESSIONAL, not by domain.
 *
 * - Different professionals for different domains -> separate agreements.
 * - Same professional across several domains       -> one combined agreement.
 *
 * Business rule enforced in application logic (not a DB constraint): every
 * lead-domain linked to an agreement must have selected the same professional.
 */
export interface Agreement extends BaseRecord {
  id: ID;
  reference: string;
  leadId: ID;
  clientId: ID;
  professionalId: ID;
  /** Sum of the accepted quote totals this agreement covers. */
  totalValue: Rupees;
  /**
   * Money moves off-platform for now, so terms are recorded rather than
   * enforced. An escrow/gateway module can later read from this shape.
   */
  paymentTerms: string;
  status: AgreementStatus;
  documentUrl: string | null;
  sentAt: Timestamp | null;
  signedAt: Timestamp | null;
  startDate: DateOnly | null;
  cancelledReason: string | null;
}

/** Which lead-domains a given agreement covers. */
export interface AgreementLeadDomain extends BaseRecord {
  id: ID;
  agreementId: ID;
  leadDomainId: ID;
  /** The accepted quote for this domain at signing time. */
  quoteId: ID;
  value: Rupees;
}
