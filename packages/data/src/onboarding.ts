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
import { api } from "./client";
import { callingApiAsUser, currentProfessionalId, currentStaffUserId } from "./session";
import { delay, nextId, nowIso, store } from "./store";

export async function getPartnerTerms(): Promise<PartnerTerms> {
  return delay(partnerTerms);
}

/**
 * Synchronous lookup, for code inside this package that is already holding the
 * store. Not exported: every caller outside gets the async version, because
 * with a backend this is a request.
 */
function findPartnerAgreement(professionalId: string): PartnerAgreement | null {
  return (
    store.partnerAgreements.find(
      (a) => a.professionalId === professionalId && a.status !== "superseded",
    ) ?? null
  );
}

export async function getPartnerAgreement(
  professionalId: string,
): Promise<PartnerAgreement | null> {
  return delay(findPartnerAgreement(professionalId));
}

/** True only when the vendor has signed the current version of the terms. */
export function hasSignedPartnerAgreementSync(professionalId: string): boolean {
  const agreement = findPartnerAgreement(professionalId);
  return agreement?.status === "signed" && agreement.termsVersion === partnerTerms.version;
}

export async function hasSignedPartnerAgreement(professionalId: string): Promise<boolean> {
  return delay(hasSignedPartnerAgreementSync(professionalId));
}

/**
 * A staff view of someone else's onboarding. Separate from `getVendorOnboarding`
 * on purpose: a function that reads *any* vendor by id must be callable only by
 * ops, and that is easier to keep true when the two have different names.
 */
export async function getVendorOnboardingFor(
  professionalId: string,
): Promise<VendorOnboarding | null> {
  const pro = store.professionals.find((p) => p.id === professionalId);
  if (!pro) return delay(null);

  const agreement = findPartnerAgreement(professionalId);
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
      done: hasSignedPartnerAgreementSync(professionalId),
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
  if (await callingApiAsUser()) {
    return api<PartnerAgreement>("/vendor/onboarding/agreement", {
      method: "POST",
      body: input,
    });
  }

  const required = partnerTerms.acknowledgements.map((a) => a.key);
  const missing = required.filter((key) => !input.acknowledgedClauses.includes(key));
  if (missing.length > 0) {
    throw new Error("Every clause must be acknowledged before signing");
  }
  if (input.signatureText.trim().length < 3) {
    throw new Error("A signature is required");
  }

  const professionalId = await currentProfessionalId();
  const existing = findPartnerAgreement(professionalId);
  if (existing) existing.status = "superseded";

  const agreement: PartnerAgreement = {
    id: nextId("pa"),
    professionalId,
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
    documentUrl: `/mock/partner-agreements/${professionalId}-${partnerTerms.version}.pdf`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    deletedAt: null,
  };
  store.partnerAgreements.push(agreement);

  store.notifications.push({
    id: nextId("ntf"),
    userId: "user-admin",
    type: "agreement_signed",
    title: `${store.professionals.find((p) => p.id === professionalId)?.companyName ?? "A vendor"} signed the partner agreement`,
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
  /** Already uploaded, via `uploadFiles` — this carries ids, not bytes. */
  proof: MediaAsset[];
}

/**
 * A vendor closing out a stage. The stage is not marked complete here — it is
 * marked *submitted*, and our team approves it. That gap is the whole point:
 * "done" should mean somebody checked, not that somebody said so.
 */
export async function submitMilestoneProof(input: MilestoneProofInput): Promise<void> {
  if (await callingApiAsUser()) {
    await api(
      `/vendor/projects/${encodeURIComponent(input.projectId)}/stages/${encodeURIComponent(
        input.milestoneId,
      )}/proof`,
      // Asset ids, never bytes — the files went straight to storage from the
      // browser through an upload ticket.
      { method: "POST", body: { note: input.note, proof: input.proof.map((p) => p.id) } },
    );
    return;
  }

  const project = store.projects.find((p) => p.id === input.projectId);
  if (!project) throw new Error("Unknown project");
  const milestone = project.milestones.find((m) => m.id === input.milestoneId);
  if (!milestone) throw new Error("Unknown stage");

  if (input.proof.length === 0) throw new Error("At least one photograph is required");

  milestone.proof = [...milestone.proof, ...input.proof];
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
): Promise<void> {
  const reviewerUserId = await currentStaffUserId();
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

/** The signed-in professional's own onboarding progress. */
export async function getVendorOnboarding(): Promise<VendorOnboarding | null> {
  if (await callingApiAsUser()) return api<VendorOnboarding>("/vendor/onboarding");
  return getVendorOnboardingFor(await currentProfessionalId());
}
