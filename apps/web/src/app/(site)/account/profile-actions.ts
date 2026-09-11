"use server";

import { revalidatePath } from "next/cache";
import {
  ApiError,
  confirmMyMobile,
  requestMyMobileCode,
  setMyCity,
  type OtpChannel,
} from "@repo/data";

/**
 * Filling in what signing up did not insist on.
 *
 * These run as server actions for the same reason sign-in does: the session
 * cookie is httpOnly, so only a server response can read it, and keeping the
 * API's address out of the browser means the backend needs no public origin.
 */

export interface MobileCodeState {
  challengeId?: string;
  expiresInSeconds?: number;
  /** Where the code went, so the form can say where to look. */
  channel?: OtpChannel;
  /** Shown in development only, when the API echoes the code instead of sending it. */
  devCode?: string;
  error?: string;
}

export async function requestMyMobileCodeAction(
  mobile: string,
  channel?: OtpChannel,
): Promise<MobileCodeState> {
  try {
    const result = await requestMyMobileCode(mobile, channel);
    return {
      challengeId: result.challengeId,
      expiresInSeconds: result.expiresInSeconds,
      channel: result.channel,
      devCode: result.devCode,
    };
  } catch (error) {
    return { error: messageFor(error, "We could not send a code just now.") };
  }
}

export async function confirmMyMobileAction(input: {
  challengeId: string;
  code: string;
}): Promise<{ error?: string; ok?: true }> {
  try {
    await confirmMyMobile(input);
  } catch (error) {
    return { error: messageFor(error, "That code did not work.") };
  }

  // The number shows up in the header menu and on the account screens, and the
  // prompt that asked for it has to stop asking.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setMyCityAction(cityId: string | null): Promise<{ error?: string; ok?: true }> {
  try {
    await setMyCity(cityId);
  } catch (error) {
    return { error: messageFor(error, "We could not save that just now.") };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

function messageFor(error: unknown, fallback: string): string {
  // The API writes messages meant to be read by the person who caused them —
  // "That number is already on another account" — so pass them through rather
  // than replacing them with something vaguer.
  if (error instanceof ApiError && error.isClientError) return error.message;
  return fallback;
}
