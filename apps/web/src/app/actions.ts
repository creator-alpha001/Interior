"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSupportTicket,
  demoClientId,
  generateAgreements,
  markNotificationsRead,
  replyToTicket,
  requestReschedule,
  selectQuote,
  sendClientMessage,
  signAgreement,
  submitRequirement,
  submitReview,
} from "@repo/data";
import type { RequirementInput, ReviewInput, TicketInput } from "@repo/data";
import { DEMO_USER_ID } from "@/lib/session";

/**
 * Server actions are the seam the real API will sit behind. Today they call the
 * in-memory data layer directly; later they call the backend and everything
 * calling them stays the same.
 */

/* ---------------- Requirements ---------------- */

export async function createRequirementAction(input: RequirementInput) {
  const lead = await submitRequirement(input);
  redirect(`/account/requirements/${lead.lead.id}?new=1`);
}

export async function selectQuoteAction(leadDomainId: string, quoteId: string, leadId: string) {
  await selectQuote(leadDomainId, quoteId);
  redirect(`/account/requirements/${leadId}?selected=1`);
}

export async function generateAgreementsAction(leadId: string) {
  await generateAgreements(leadId);
  redirect(`/account/agreements?generated=1`);
}

/**
 * A client message always lands in their thread with the platform. There is no
 * action here that writes into a vendor thread from a client screen.
 */
export async function sendClientMessageAction(
  leadDomainId: string,
  body: string,
  leadId: string,
) {
  await sendClientMessage(leadDomainId, demoClientId, body);
  revalidatePath(`/account/requirements/${leadId}`);
}

export async function requestRescheduleAction(
  meetingId: string,
  note: string,
  leadId: string,
) {
  await requestReschedule(meetingId, note);
  revalidatePath(`/account/requirements/${leadId}`);
}

/* ---------------- Agreements ---------------- */

export async function signAgreementAction(agreementId: string) {
  await signAgreement(agreementId);
  revalidatePath("/account/agreements");
  revalidatePath("/account/projects");
  redirect("/account/agreements?signed=1");
}

/* ---------------- Reviews ---------------- */

export async function submitReviewAction(input: ReviewInput) {
  await submitReview(input);
  revalidatePath("/account/projects");
}

/* ---------------- Notifications ---------------- */

export async function markNotificationsReadAction() {
  await markNotificationsRead(DEMO_USER_ID);
  revalidatePath("/account/notifications");
  revalidatePath("/account");
}

/* ---------------- Support ---------------- */

export async function createTicketAction(input: Omit<TicketInput, "raisedByUserId">) {
  await createSupportTicket({ ...input, raisedByUserId: DEMO_USER_ID });
  revalidatePath("/account/support");
  redirect("/account/support?raised=1");
}

export async function replyToTicketAction(ticketId: string, body: string) {
  await replyToTicket(ticketId, "Priya Sharma", body);
  revalidatePath("/account/support");
}

/* ---------------- Preferences ---------------- */

/**
 * The chosen city drives which professionals can be assigned and which price
 * a catalogue item shows, so it is stored server-side rather than in component
 * state — every server-rendered price reads the same value.
 */
export async function setCityAction(cityId: string, returnTo: string) {
  const jar = await cookies();
  jar.set("city", cityId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath(returnTo || "/");
}
