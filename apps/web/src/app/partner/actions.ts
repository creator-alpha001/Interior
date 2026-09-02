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
import type { MediaAsset } from "@repo/types";

export async function submitQuoteAction(input: QuoteDraftInput) {
  await submitQuote(input);
  revalidatePath(`/leads/${input.leadDomainId}`);
  revalidatePath("/leads");
  revalidatePath("/");
}

export async function respondToLeadAction(
  leadDomainId: string,
  response: "accepted" | "rejected",
  reason?: string,
) {
  await respondToLead(leadDomainId, response, reason);
  revalidatePath(`/leads/${leadDomainId}`);
  revalidatePath("/leads");
}

/** Their thread is with our coordinator — there is no path to the client here. */
export async function sendVendorMessageAction(leadDomainId: string, body: string) {
  await sendVendorMessage(leadDomainId, body);
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
  await signPartnerAgreement(input);
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
  proof: MediaAsset[],
) {
  await submitMilestoneProof({ projectId, milestoneId, note, proof });
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/");
}
