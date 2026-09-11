"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ApiError,
  reportHardcopySent,
  requestUploadTicket,
  respondToLead,
  sendVendorMessage,
  signPartnerAgreement,
  submitMilestoneProof,
  submitQuote,
  submitSignedCopy,
  submitVendorDocument,
} from "@repo/data";
import type {
  HardcopyReport,
  QuoteDraftInput,
  SignedCopyInput,
  TicketRequest,
  UploadTicketResult,
  VendorDocumentInput,
} from "@repo/data";
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
  revalidatePath("/partner/onboarding");
  revalidatePath("/partner");
  revalidatePath("/partner/profile");
}

/* ---------------- Uploads ---------------- */

/**
 * An upload ticket, asked for by this server with the vendor's session.
 *
 * The browser cannot ask the API itself: the session cookie belongs to this
 * site's host, so a direct request arrives as nobody. See `requestUploadTicket`.
 */
export async function issueUploadTicketAction(request: TicketRequest): Promise<UploadTicketResult> {
  return requestUploadTicket(request);
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
  revalidatePath(`/partner/leads/${input.leadDomainId}`);
  revalidatePath("/partner/leads");
  revalidatePath("/partner");
}

export async function respondToLeadAction(
  leadDomainId: string,
  response: "accepted" | "rejected",
  reason?: string,
) {
  await respondToLead(leadDomainId, response, reason);
  revalidatePath(`/partner/leads/${leadDomainId}`);
  revalidatePath("/partner/leads");
}

/** Their thread is with our coordinator — there is no path to the client here. */
export async function sendVendorMessageAction(leadDomainId: string, body: string) {
  await sendVendorMessage(leadDomainId, body);
  revalidatePath(`/partner/leads/${leadDomainId}`);
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
  revalidatePath("/partner/onboarding");
  revalidatePath("/partner");
  revalidatePath("/partner/profile");
  // The portal lives under /partner. This redirected to /onboarding, which does
  // not exist, so accepting the terms ended on a not-found page.
  redirect("/partner/onboarding?signed=1");
}

/* ---------------- Stage evidence ---------------- */

export async function submitStageProofAction(
  projectId: string,
  milestoneId: string,
  note: string,
  proof: MediaAsset[],
) {
  await submitMilestoneProof({ projectId, milestoneId, note, proof });
  revalidatePath(`/partner/projects/${projectId}`);
  revalidatePath("/partner/projects");
  revalidatePath("/partner");
}
