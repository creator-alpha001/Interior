import { z } from "zod";
import {
  baseRecordSchema,
  dateOnlySchema,
  idSchema,
  rupeesSchema,
  timestampSchema,
} from "./common";

export const agreementStatusSchema = z.enum([
  "draft",
  "sent",
  "signed",
  "active",
  "completed",
  "cancelled",
]);

/**
 * Agreements group by PROFESSIONAL, not by domain.
 *
 * - Different professionals for different domains -> separate agreements.
 * - Same professional across several domains       -> one combined agreement.
 *
 * Business rule enforced in application logic (not a DB constraint): every
 * lead-domain linked to an agreement must have selected the same professional.
 */
export const agreementSchema = baseRecordSchema.extend({
  id: idSchema,
  reference: z.string(),
  leadId: idSchema,
  clientId: idSchema,
  professionalId: idSchema,
  /** Sum of the accepted quote totals this agreement covers. */
  totalValue: rupeesSchema,
  /**
   * Money moves off-platform for now, so terms are recorded rather than
   * enforced. An escrow/gateway module can later read from this shape.
   */
  paymentTerms: z.string(),
  status: agreementStatusSchema,
  documentUrl: z.string().nullable(),
  sentAt: timestampSchema.nullable(),
  signedAt: timestampSchema.nullable(),
  startDate: dateOnlySchema.nullable(),
  cancelledReason: z.string().nullable(),
});

/** Which lead-domains a given agreement covers. */
export const agreementLeadDomainSchema = baseRecordSchema.extend({
  id: idSchema,
  agreementId: idSchema,
  leadDomainId: idSchema,
  /** The accepted quote for this domain at signing time. */
  quoteId: idSchema,
  value: rupeesSchema,
});
