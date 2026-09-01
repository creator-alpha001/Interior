"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  respondToLead,
  sendVendorMessage,
  signPartnerAgreement,
  submitMilestoneProof,
  submitQuote,
  updateProjectProgress,
} from "@repo/data";
import type { QuoteDraftInput } from "@repo/data";
import { CURRENT_PROFESSIONAL_ID } from "@/lib/session";

export async function submitQuoteAction(
  input: Omit<QuoteDraftInput, "professionalId">,
) {
  await submitQuote({ ...input, professionalId: CURRENT_PROFESSIONAL_ID });
  revalidatePath(`/leads/${input.leadDomainId}`);
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function respondToLeadAction(
  leadDomainId: string,
  response: "accepted" | "rejected",
  reason?: string,
) {
  await respondToLead(leadDomainId, CURRENT_PROFESSIONAL_ID, response, reason);
  revalidatePath(`/leads/${leadDomainId}`);
  revalidatePath("/leads");
}

/** Their thread is with our coordinator — there is no path to the client here. */
export async function sendVendorMessageAction(leadDomainId: string, body: string) {
  await sendVendorMessage(leadDomainId, CURRENT_PROFESSIONAL_ID, body);
  revalidatePath(`/leads/${leadDomainId}`);
}

export async function updateProgressAction(
  projectId: string,
  completionPercent: number,
  milestoneId?: string,
) {
  await updateProjectProgress(projectId, completionPercent, milestoneId);
  revalidatePath("/projects");
  revalidatePath("/");
}

/* ---------------- Onboarding ---------------- */

/**
 * Signing unlocks lead assignment, so every screen that depends on that state
 * is revalidated — otherwise the vendor signs and still sees "not receiving
 * leads" until something else happens to refresh.
 */
export async function signPartnerAgreementAction(input: {
  signatoryName: string;
  signatoryRole: string;
  signatureText: string;
  acknowledgedClauses: string[];
}) {
  await signPartnerAgreement({ ...input, professionalId: CURRENT_PROFESSIONAL_ID });
  revalidatePath("/onboarding");
  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/onboarding?signed=1");
}

/* ---------------- Stage evidence ---------------- */

export async function submitStageProofAction(
  projectId: string,
  milestoneId: string,
  note: string,
  photoCount: number,
) {
  await submitMilestoneProof({ projectId, milestoneId, note, photoCount });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}
