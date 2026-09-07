import { z } from "zod";
import { baseRecordSchema, dateOnlySchema, idSchema, timestampSchema } from "./common";

/**
 * The terms a professional accepts to work through the platform.
 *
 * Versioned, because terms change and it matters which set a given vendor
 * actually agreed to — an agreement that points at "the current terms" is
 * worth very little when the terms have moved on.
 */
export const partnerTermsSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
});

/**
 * One clause that must be ticked on its own.
 *
 * `key` is what gets stored in `acknowledgedClauses`, so consent can be proved
 * clause by clause rather than as a single "I agree".
 */
export const partnerAcknowledgementSchema = z.object({
  key: z.string(),
  label: z.string(),
});

export const partnerTermsSchema = z.object({
  version: z.string(),
  effectiveFrom: dateOnlySchema,
  title: z.string(),
  summary: z.string(),
  sections: z.array(partnerTermsSectionSchema),
  /**
   * Clauses that must be ticked individually rather than swept up in a single
   * "I agree". These are the ones vendors most often claim not to have seen.
   */
  acknowledgements: z.array(partnerAcknowledgementSchema),
});

export const partnerAgreementStatusSchema = z.enum([
  "pending",
  "signed",
  "superseded",
  "withdrawn",
]);

/**
 * A vendor's signature against one version of the terms. Signing is what
 * unlocks lead assignment — an unsigned vendor is not in any pool.
 */
export const partnerAgreementSchema = baseRecordSchema.extend({
  id: idSchema,
  professionalId: idSchema,
  termsVersion: z.string(),
  status: partnerAgreementStatusSchema,
  /** Typed signature — the name the signatory entered, exactly as entered. */
  signatureText: z.string().nullable(),
  signatoryName: z.string().nullable(),
  signatoryRole: z.string().nullable(),
  signedAt: timestampSchema.nullable(),
  /** Every clause ticked, stored so consent can be proved clause by clause. */
  acknowledgedClauses: z.array(z.string()),
  /** Recorded at signing, for the audit trail. */
  signedFromIp: z.string().nullable(),
  signedUserAgent: z.string().nullable(),
  documentUrl: z.string().nullable(),
});

export const onboardingStepKeySchema = z.enum([
  "profile",
  "identity",
  "trades",
  "service_areas",
  "portfolio",
  "agreement",
  "bank",
]);

export const onboardingStepSchema = z.object({
  key: onboardingStepKeySchema,
  label: z.string(),
  description: z.string(),
  done: z.boolean(),
  /** A vendor cannot receive leads until every blocking step is complete. */
  blocking: z.boolean(),
  hint: z.string().nullable(),
});

export const vendorOnboardingSchema = z.object({
  professionalId: idSchema,
  steps: z.array(onboardingStepSchema),
  completedCount: z.number(),
  totalCount: z.number(),
  /** False while any blocking step is outstanding. */
  canReceiveLeads: z.boolean(),
  blockedReason: z.string().nullable(),
  agreement: partnerAgreementSchema.nullable(),
  terms: partnerTermsSchema,
});
