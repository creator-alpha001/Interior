/**
 * Vendor onboarding and the partner agreement.
 *
 * The rule this module exists to enforce: an unsigned vendor is in no lead
 * pool. Approving someone's trade and letting them work are two different
 * decisions, and the signature is what separates them.
 */
import type {
  MediaAsset,
  OnboardingStep,
  PartnerAgreement,
  PartnerTerms,
  VendorOnboarding,
} from "@repo/types";
import { partnerTerms } from "@repo/mock";
import { delay, nextId, nowIso, store } from "./store";

export function getPartnerTerms(): PartnerTerms {
  return partnerTerms;
}

export function getPartnerAgreement(professionalId: string): PartnerAgreement | null {
  return (
    store.partnerAgreements.find(
      (a) => a.professionalId === professionalId && a.status !== "superseded",
    ) ?? null
  );
}

/** True only when the vendor has signed the current version of the terms. */
export function hasSignedPartnerAgreement(professionalId: string): boolean {
  const agreement = getPartnerAgreement(professionalId);
  return (
    agreement?.status === "signed" && agreement.termsVersion === partnerTerms.version
  );
}

export async function getVendorOnboarding(
  professionalId: string,
): Promise<VendorOnboarding | null> {
  const pro = store.professionals.find((p) => p.id === professionalId);
  if (!pro) return delay(null);

  const agreement = getPartnerAgreement(professionalId);
  const trades = store.professionalDomains.filter((pd) => pd.professionalId === professionalId);
  const approvedTrades = trades.filter((t) => t.verificationStatus === "approved");
  const areas = store.professionalServiceAreas.filter((a) => a.professionalId === professionalId);
  const portfolio = store.portfolioItems.filter((p) => p.professionalId === professionalId);

  const steps: OnboardingStep[] = [
    {
      key: "profile",
      label: "Business profile",
      description: "Company name, years of experience and a description of what you do.",
      done: pro.companyName.length > 0 && pro.bio.length > 20,
      blocking: true,
      hint: null,
    },
    {
      key: "identity",
      label: "Identity and business proof",
      description: "Government ID, and GST registration where you are registered.",
      done: pro.verificationStatus === "verified",
      blocking: true,
      hint:
        pro.verificationStatus === "pending"
          ? "Our team is reviewing your documents."
          : pro.verificationStatus === "suspended"
            ? "Your account is under review. Nothing will be assigned meanwhile."
            : null,
    },
    {
      key: "trades",
      label: "Trades approved",
      description: "Each trade is approved separately by our team.",
      done: approvedTrades.length > 0,
      blocking: true,
      hint: trades.some((t) => t.verificationStatus === "pending")
        ? `${trades.filter((t) => t.verificationStatus === "pending").length} awaiting approval`
        : null,
    },
    {
      key: "service_areas",
      label: "Service areas",
      description: "The cities and localities you actually travel to.",
      done: areas.length > 0,
      blocking: true,
      hint: null,
    },
    {
      key: "agreement",
      label: "Partner agreement signed",
      description: `Version ${partnerTerms.version} of the terms of working with us.`,
      done: hasSignedPartnerAgreement(professionalId),
      blocking: true,
      hint: agreement?.status === "signed" ? null : "You will receive no leads until this is signed.",
    },
    {
      key: "portfolio",
      label: "Work photos",
      description: "At least five completed jobs, so customers can see your work.",
      done: portfolio.length >= 1,
      blocking: false,
      hint: portfolio.length === 0 ? "Profiles with photos win noticeably more work." : null,
    },
    {
      key: "bank",
      label: "Bank details",
      description: "For commission invoicing. Added after approval.",
      done: pro.gstNumber !== null,
      blocking: false,
      hint: null,
    },
  ];

  const blocking = steps.filter((s) => s.blocking && !s.done);

  return delay({
    professionalId,
    steps,
    completedCount: steps.filter((s) => s.done).length,
    totalCount: steps.length,
    canReceiveLeads: blocking.length === 0,
    blockedReason:
      blocking.length === 0
        ? null
        : blocking[0].key === "agreement"
          ? "The partner agreement has not been signed yet."
          : `Outstanding: ${blocking.map((s) => s.label.toLowerCase()).join(", ")}.`,
    agreement,
    terms: partnerTerms,
  });
}

export interface SignAgreementInput {
  professionalId: string;
  signatoryName: string;
  signatoryRole: string;
  signatureText: string;
  acknowledgedClauses: string[];
  userAgent?: string;
}

/**
 * Signing records the typed signature exactly as entered, every clause ticked
 * individually, and when. Consent that cannot be shown clause by clause is not
 * much use the day somebody disputes it.
 */
export async function signPartnerAgreement(
  input: SignAgreementInput,
): Promise<PartnerAgreement> {
  const required = partnerTerms.acknowledgements.map((a) => a.key);
  const missing = required.filter((key) => !input.acknowledgedClauses.includes(key));
  if (missing.length > 0) {
    throw new Error("Every clause must be acknowledged before signing");
  }
  if (input.signatureText.trim().length < 3) {
    throw new Error("A signature is required");
  }

  const existing = getPartnerAgreement(input.professionalId);
  if (existing) existing.status = "superseded";

  const agreement: PartnerAgreement = {
    id: nextId("pa"),
    professionalId: input.professionalId,
    termsVersion: partnerTerms.version,
    status: "signed",
    signatureText: input.signatureText.trim(),
    signatoryName: input.signatoryName.trim(),
    signatoryRole: input.signatoryRole.trim(),
    signedAt: nowIso(),
    acknowledgedClauses: input.acknowledgedClauses,
    // A real implementation captures these server-side; the shape is what
    // matters here so the audit trail does not need reworking later.
    signedFromIp: "recorded at signing",
    signedUserAgent: input.userAgent ?? null,
    documentUrl: `/mock/partner-agreements/${input.professionalId}-${partnerTerms.version}.pdf`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.partnerAgreements.push(agreement);

  store.notifications.push({
    id: nextId("ntf"),
    userId: "user-admin",
    type: "agreement_signed",
    title: `${store.professionals.find((p) => p.id === input.professionalId)?.companyName ?? "A vendor"} signed the partner agreement`,
    body: `Version ${partnerTerms.version}. They can now be assigned leads.`,
    entityType: "agreement",
    entityId: agreement.id,
    isRead: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  });

  return delay(agreement);
}

/* ------------------------------------------------------------------ *
 * Stage evidence
 * ------------------------------------------------------------------ */

export interface MilestoneProofInput {
  projectId: string;
  milestoneId: string;
  note: string;
  /** How many photos were attached; the store fabricates placeholders. */
  photoCount: number;
}

/**
 * A vendor closing out a stage. The stage is not marked complete here — it is
 * marked *submitted*, and our team approves it. That gap is the whole point:
 * "done" should mean somebody checked, not that somebody said so.
 */
export async function submitMilestoneProof(input: MilestoneProofInput): Promise<void> {
  const project = store.projects.find((p) => p.id === input.projectId);
  if (!project) throw new Error("Unknown project");
  const milestone = project.milestones.find((m) => m.id === input.milestoneId);
  if (!milestone) throw new Error("Unknown stage");

  const proof: MediaAsset[] = Array.from({ length: Math.max(1, input.photoCount) }, (_, i) => ({
    id: nextId("media"),
    url: `ph:proof:${input.milestoneId}-${i + 1}`,
    type: "photo",
    caption: milestone.title,
  }));

  milestone.proof = [...milestone.proof, ...proof];
  milestone.proofNote = input.note;
  milestone.submittedAt = nowIso();
  milestone.verification = "submitted";
  milestone.verifierNote = null;
  project.updatedAt = nowIso();

  store.notifications.push({
    id: nextId("ntf"),
    userId: "user-admin",
    type: "project_started",
    title: `Stage evidence submitted — ${milestone.title}`,
    body: `${project.reference} · awaiting review.`,
    entityType: "project",
    entityId: project.id,
    isRead: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  });

  return delay(undefined);
}

/**
 * Our team accepting or rejecting the evidence. Approval is what closes the
 * stage and moves the completion percentage the customer sees.
 */
export async function reviewMilestoneProof(
  projectId: string,
  milestoneId: string,
  approve: boolean,
  note: string | null,
  reviewerUserId: string,
): Promise<void> {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Unknown project");
  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (!milestone) throw new Error("Unknown stage");

  if (approve) {
    milestone.verification = "approved";
    milestone.completedAt = nowIso();
    milestone.verifiedAt = nowIso();
    milestone.verifiedByUserId = reviewerUserId;
    milestone.verifierNote = note;
  } else {
    milestone.verification = "rejected";
    milestone.completedAt = null;
    milestone.verifiedAt = nowIso();
    milestone.verifiedByUserId = reviewerUserId;
    milestone.verifierNote = note;
  }

  // Completion follows approved stages only.
  const approved = project.milestones.filter((m) => m.verification === "approved").length;
  project.completionPercent = Math.round((approved / project.milestones.length) * 100);

  if (project.completionPercent === 100 && project.status === "ongoing") {
    project.status = "completed";
    project.actualEndDate = nowIso().slice(0, 10);
    const leadDomain = store.leadDomains.find((ld) => ld.id === project.leadDomainId);
    if (leadDomain) leadDomain.status = "completed";
  }
  project.updatedAt = nowIso();
  return delay(undefined);
}
