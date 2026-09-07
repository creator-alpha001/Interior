/** Contracts, grouped by professional rather than by service. */
import type { z } from "zod";
import type {
  agreementLeadDomainSchema,
  agreementSchema,
  agreementStatusSchema,
} from "./schema/agreements";

export type AgreementStatus = z.infer<typeof agreementStatusSchema>;

/**
 * Agreements group by PROFESSIONAL, not by domain.
 *
 * - Different professionals for different domains -> separate agreements.
 * - Same professional across several domains       -> one combined agreement.
 *
 * Business rule enforced in application logic (not a DB constraint): every
 * lead-domain linked to an agreement must have selected the same professional.
 */
export type Agreement = z.infer<typeof agreementSchema>;

/** Which lead-domains a given agreement covers. */
export type AgreementLeadDomain = z.infer<typeof agreementLeadDomainSchema>;
