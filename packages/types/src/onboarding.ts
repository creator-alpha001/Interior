import type { BaseRecord, DateOnly, ID, Timestamp } from "./common";

/**
 * The terms a professional accepts to work through the platform.
 *
 * Versioned, because terms change and it matters which set a given vendor
 * actually agreed to — an agreement that points at "the current terms" is
 * worth very little when the terms have moved on.
 */
export interface PartnerTerms {
  version: string;
  effectiveFrom: DateOnly;
  title: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
  /**
   * Clauses that must be ticked individually rather than swept up in a single
   * "I agree". These are the ones vendors most often claim not to have seen.
   */
  acknowledgements: Array<{ key: string; label: string }>;
}

export type PartnerAgreementStatus = "pending" | "signed" | "superseded" | "withdrawn";

/**
 * A vendor's signature against one version of the terms. Signing is what
 * unlocks lead assignment — an unsigned vendor is not in any pool.
 */
export interface PartnerAgreement extends BaseRecord {
  id: ID;
  professionalId: ID;
  termsVersion: string;
  status: PartnerAgreementStatus;
  /** Typed signature — the name the signatory entered, exactly as entered. */
  signatureText: string | null;
  signatoryName: string | null;
  signatoryRole: string | null;
  signedAt: Timestamp | null;
  /** Every clause ticked, stored so consent can be proved clause by clause. */
  acknowledgedClauses: string[];
  /** Recorded at signing, for the audit trail. */
  signedFromIp: string | null;
  signedUserAgent: string | null;
  documentUrl: string | null;
}

export type OnboardingStepKey =
  | "profile"
  | "identity"
  | "trades"
  | "service_areas"
  | "portfolio"
  | "agreement"
  | "bank";

export interface OnboardingStep {
  key: OnboardingStepKey;
  label: string;
  description: string;
  done: boolean;
  /** A vendor cannot receive leads until every blocking step is complete. */
  blocking: boolean;
  hint: string | null;
}

export interface VendorOnboarding {
  professionalId: ID;
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  /** False while any blocking step is outstanding. */
  canReceiveLeads: boolean;
  blockedReason: string | null;
  agreement: PartnerAgreement | null;
  terms: PartnerTerms;
}
