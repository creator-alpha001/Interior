"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ApiError,
  reportHardcopySent,
  respondToLead,
  sendVendorMessage,
  signPartnerAgreement,
  submitMilestoneProof,
  submitQuote,
  submitSignedCopy,
  submitVendorDocument,
} from "@repo/data";
import type { HardcopyReport, QuoteDraftInput, SignedCopyInput, VendorDocumentInput } from "@repo/data";
import type { MediaAsset } from "@repo/types";

/**
 * What a paperwork form gets back.
 *
 * `{ error }` rather than a throw: a vendor who has photographed eleven pages
 * should see why the upload was refused and keep what they picked, not lose it
 * all to an error page.
 */
type ActionResult = { error?: string };

function explain(error: unknown, fallback: string): ActionResult {
  if (error instanceof ApiError) return error.isClientError ? { error: error.message } : { error: fallback };
  // Without a backend the seed store refuses with a plain Error, written for the vendor.
  if (error instanceof Error) return { error: error.message };
  return { error: fallback };
}

function revalidateVerification() {
  revalidatePath("/onboarding");
  revalidatePath("/");
  revalidatePath("/profile");
}

/* ---------------- Verification ---------------- */

export async function submitSignedCopyAction(input: SignedCopyInput): Promise<ActionResult> {
  try {
    await submitSignedCopy(input);
  } catch (error) {
    return explain(error, "The signed agreement could not be sent. Please try again.");
  }
  revalidateVerification();
  return {};
}

export async function reportHardcopyAction(input: HardcopyReport): Promise<ActionResult> {
  try {
    await reportHardcopySent(input);
  } catch (error) {
    return explain(error, "That could not be saved. Please try again.");
  }
  revalidateVerification();
  return {};
}

export async function submitVendorDocumentAction(input: VendorDocumentInput): Promise<ActionResult> {
  try {
    await submitVendorDocument(input);
  } catch (error) {
    return explain(error, "That document could not be sent. Please try again.");
  }
  revalidateVerification();
  return {};
}

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
