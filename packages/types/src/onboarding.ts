/** What a professional must complete before they are in any lead pool. */
import type { z } from "zod";
import type {
  hardcopyMethodSchema,
  hardcopyStatusSchema,
  onboardingStepKeySchema,
  onboardingStepSchema,
  partnerAgreementSchema,
  partnerAgreementStatusSchema,
  partnerAcknowledgementSchema,
  partnerTermsSchema,
  partnerTermsSectionSchema,
  signedCopyStatusSchema,
  vendorDocumentKindSchema,
  vendorDocumentSchema,
  vendorDocumentSlotSchema,
  vendorDocumentStatusSchema,
  vendorOnboardingSchema,
  vendorVerificationSchema,
} from "./schema/onboarding";

/**
 * The terms a professional accepts to work through the platform.
 *
 * Versioned, because terms change and it matters which set a given vendor
 * actually agreed to — an agreement that points at "the current terms" is
 * worth very little when the terms have moved on.
 */
export type PartnerTerms = z.infer<typeof partnerTermsSchema>;

export type PartnerTermsSection = z.infer<typeof partnerTermsSectionSchema>;

/** One clause a vendor ticks on its own, so consent is provable clause by clause. */
export type PartnerAcknowledgement = z.infer<typeof partnerAcknowledgementSchema>;

export type PartnerAgreementStatus = z.infer<typeof partnerAgreementStatusSchema>;

/**
 * A vendor's signature against one version of the terms. Signing is what
 * unlocks lead assignment — an unsigned vendor is not in any pool.
 */
export type PartnerAgreement = z.infer<typeof partnerAgreementSchema>;

export type OnboardingStepKey = z.infer<typeof onboardingStepKeySchema>;

export type OnboardingStep = z.infer<typeof onboardingStepSchema>;

export type VendorOnboarding = z.infer<typeof vendorOnboardingSchema>;

export type SignedCopyStatus = z.infer<typeof signedCopyStatusSchema>;

export type HardcopyMethod = z.infer<typeof hardcopyMethodSchema>;

export type HardcopyStatus = z.infer<typeof hardcopyStatusSchema>;

export type VendorDocumentKind = z.infer<typeof vendorDocumentKindSchema>;

export type VendorDocumentStatus = z.infer<typeof vendorDocumentStatusSchema>;

export type VendorDocument = z.infer<typeof vendorDocumentSchema>;

export type VendorDocumentSlot = z.infer<typeof vendorDocumentSlotSchema>;

/** Everything between an approved vendor and the verified tag. */
export type VendorVerification = z.infer<typeof vendorVerificationSchema>;
