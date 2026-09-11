import { z } from "zod";
import {
  baseRecordSchema,
  dateOnlySchema,
  idSchema,
  mediaAssetSchema,
  timestampSchema,
} from "./common";
import { verificationStatusSchema } from "./identity";

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
  /**
   * The standard agreement to print, sign and return, as uploaded by our team.
   * Null until one has been uploaded for this version.
   */
  documentUrl: z.string().nullable(),
  /** Where to send the signed original, or how to arrange handing it over. */
  hardcopyInstructions: z.string(),
});

export const partnerAgreementStatusSchema = z.enum([
  "pending",
  "signed",
  "superseded",
  "withdrawn",
]);

/** Where the photographed pages of the paper agreement have got to. */
export const signedCopyStatusSchema = z.enum(["not_submitted", "submitted", "accepted", "rejected"]);

/** How the signed original reaches us. */
export const hardcopyMethodSchema = z.enum(["courier", "in_person"]);

export const hardcopyStatusSchema = z.enum(["not_sent", "dispatched", "received"]);

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
  /**
   * The printed agreement, signed on paper.
   *
   * Accepting online is the first step, not the last. What holds up in an
   * Indian court is the signed original, so the photographed pages are
   * reviewed here and the original itself is tracked by the hardcopy fields.
   */
  signedCopyStatus: signedCopyStatusSchema,
  signedCopySubmittedAt: timestampSchema.nullable(),
  /** The e-stamp certificate number, when the original was stamped. */
  stampCertificateNumber: z.string().nullable(),
  signedCopyReviewedAt: timestampSchema.nullable(),
  signedCopyReviewedByUserId: idSchema.nullable(),
  /** Shown to the vendor, so written for them. Required on a rejection. */
  signedCopyReviewNote: z.string().nullable(),
  /** Null until the vendor tells us how the original is coming. */
  hardcopyMethod: hardcopyMethodSchema.nullable(),
  hardcopyStatus: hardcopyStatusSchema,
  hardcopyCourier: z.string().nullable(),
  hardcopyTrackingNumber: z.string().nullable(),
  hardcopyDispatchedAt: timestampSchema.nullable(),
  hardcopyReceivedAt: timestampSchema.nullable(),
  hardcopyReceivedByUserId: idSchema.nullable(),
  hardcopyNote: z.string().nullable(),
});

/**
 * There is deliberately no `bank` step.
 *
 * Decora Shine does not handle money — a customer pays their professional directly,
 * and the platform's only invoice is for commission. So there is nothing to
 * send a vendor, and no account number worth the liability of storing. The step
 * that used to sit here asked for "payment details" and then quietly checked
 * whether a GST number was present, which is a different thing again, and one
 * no screen in the product could actually set.
 */
export const onboardingStepKeySchema = z.enum([
  "profile",
  "identity",
  "trades",
  "service_areas",
  "portfolio",
  "agreement",
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
  completedCount: z.number().int(),
  totalCount: z.number().int(),
  /** False while any blocking step is outstanding. */
  canReceiveLeads: z.boolean(),
  blockedReason: z.string().nullable(),
  agreement: partnerAgreementSchema.nullable(),
  terms: partnerTermsSchema,
});

/* ------------------------------------------------------------------ *
 * Verification
 *
 * Separate from onboarding's steps on purpose. The mobile app decodes step keys
 * into a closed enum, so a new key would break every installed build; these
 * shapes are new, and additive to everything that already exists.
 * ------------------------------------------------------------------ */

export const vendorDocumentKindSchema = z.enum([
  "pan",
  "gst_certificate",
  "business_registration",
  "signatory_id",
  "address_proof",
]);

export const vendorDocumentStatusSchema = z.enum(["submitted", "accepted", "rejected"]);

/**
 * One business document a vendor has submitted.
 *
 * A replacement is a new row and the one it replaces is soft-deleted, so what a
 * vendor showed us, and when, stays reconstructable.
 */
export const vendorDocumentSchema = baseRecordSchema.extend({
  id: idSchema,
  professionalId: idSchema,
  kind: vendorDocumentKindSchema,
  /** PAN, GSTIN or registration number. Never a full Aadhaar number. */
  documentNumber: z.string().nullable(),
  status: vendorDocumentStatusSchema,
  submittedAt: timestampSchema,
  reviewedAt: timestampSchema.nullable(),
  reviewedByUserId: idSchema.nullable(),
  /** Shown to the vendor. Required on a rejection. */
  reviewNote: z.string().nullable(),
});

/** A document the vendor is asked for, and what they have sent against it. */
export const vendorDocumentSlotSchema = z.object({
  kind: vendorDocumentKindSchema,
  label: z.string(),
  description: z.string(),
  required: z.boolean(),
  /** What to call the number field, or null when the document has none. */
  numberLabel: z.string().nullable(),
  document: vendorDocumentSchema.nullable(),
  /** Private, short-lived links. */
  files: z.array(mediaAssetSchema),
});

/**
 * Everything between an approved vendor and the verified tag.
 *
 * One shape for the vendor and for ops, because the vendor's checklist and the
 * reviewer's are the same facts. `outstanding` is computed on the server by the
 * same function that refuses a premature verification.
 */
export const vendorVerificationSchema = z.object({
  professionalId: idSchema,
  verificationStatus: verificationStatusSchema,
  /** True when nothing is outstanding; ops may then mark the vendor verified. */
  canBeVerified: z.boolean(),
  outstanding: z.array(z.string()),
  /**
   * Accepted online, and the signed original received. This is what lets a
   * pending vendor receive leads; the badge still waits for everything else.
   */
  agreementComplete: z.boolean(),
  /**
   * When every required ID document must have been sent by. Null until the
   * original is received, once they have all been sent, and once verified.
   */
  documentsDueBy: timestampSchema.nullable(),
  /** True once that date has passed with documents missing. New leads pause. */
  documentsOverdue: z.boolean(),
  terms: partnerTermsSchema,
  agreement: partnerAgreementSchema.nullable(),
  /** The photographed or scanned signed pages. Private, short-lived links. */
  signedCopy: z.array(mediaAssetSchema),
  documents: z.array(vendorDocumentSlotSchema),
});
