"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ApiError,
  authenticationRequired,
  createSupportTicket,
  generateAgreements,
  getActor,
  markNotificationsRead,
  replyToTicket,
  requestOtp,
  requestReschedule,
  selectQuote,
  sendClientMessage,
  signAgreement,
  submitRequirement,
  submitReview,
  verifyOtp,
} from "@repo/data";
import type { RequirementInput, ReviewInput, TicketInput } from "@repo/data";

/**
 * Server actions are the seam the API sits behind. Screens call these; whether
 * the work happens against Postgres or the seed store is decided below them.
 */

/* ---------------- Requirements ---------------- */

export interface RequirementResult {
  /**
   * The visitor is not signed in, so their number needs verifying before a
   * requirement can be attached to an account.
   */
  needsVerification?: true;
  challengeId?: string;
  /** Development only, when the API echoes the code instead of texting it. */
  devCode?: string;
  error?: string;
}

/**
 * Submitting a requirement, verifying the visitor's number if it is their first
 * time.
 *
 * Verification happens at the *end* rather than the start, because asking
 * somebody to create an account before they have said what they want is how a
 * form loses most of the people who open it. Everything they typed stays in the
 * browser until the code is confirmed, and then both the account and the
 * requirement are created in one action.
 */
export async function createRequirementAction(
  input: RequirementInput,
  verification?: { challengeId: string; code: string },
): Promise<RequirementResult | never> {
  let cookie: string | undefined;

  if (authenticationRequired() && !(await getActor())) {
    if (!verification) {
      // First pass: send the code and let the form ask for it.
      try {
        const challenge = await requestOtp(input.mobile);
        return {
          needsVerification: true,
          challengeId: challenge.challengeId,
          devCode: challenge.devCode,
        };
      } catch (error) {
        return { error: messageFor(error, "We could not send a code just now.") };
      }
    }

    try {
      const { setCookie } = await verifyOtp({
        challengeId: verification.challengeId,
        code: verification.code,
        name: input.name,
      });

      if (setCookie) {
        const [pair] = setCookie.split(";");
        const [cookieName, ...rest] = (pair ?? "").split("=");
        if (cookieName && rest.length > 0) {
          const value = rest.join("=");
          (await cookies()).set({
            name: cookieName.trim(),
            value,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          });
          // Passed explicitly to the submit below: the cookie was set on the
          // *response*, and this request's own cookie store is what the data
          // layer would otherwise read.
          cookie = `${cookieName.trim()}=${value}`;
        }
      }
    } catch (error) {
      return { error: messageFor(error, "That code did not work.") };
    }
  }

  let leadId: string;
  try {
    const lead = await submitRequirement(input, { cookie });
    leadId = lead.lead.id;
  } catch (error) {
    return { error: messageFor(error, "We could not save that just now.") };
  }

  redirect(`/account/requirements/${leadId}?new=1`);
}

function messageFor(error: unknown, fallback: string): string {
  // The API writes messages meant for the person who caused them; passing them
  // through is more use than replacing them with something vaguer.
  if (error instanceof ApiError && error.isClientError) return error.message;
  return fallback;
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
  await sendClientMessage(leadDomainId, body);
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
  await markNotificationsRead();
  revalidatePath("/account/notifications");
  revalidatePath("/account");
}

/* ---------------- Support ---------------- */

export async function createTicketAction(input: Omit<TicketInput, "raisedByUserId">) {
  await createSupportTicket(input);
  revalidatePath("/account/support");
  redirect("/account/support?raised=1");
}

export async function replyToTicketAction(ticketId: string, body: string) {
  await replyToTicket(ticketId, body);
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
