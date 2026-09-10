/**
 * Filling in what signing up did not insist on.
 *
 * Signing up asks for a city and explains why it matters, and offers a mobile
 * number without requiring one. Both are skippable, which is only honest if
 * they can be answered afterwards — so these are the calls the prompts and the
 * account settings screen make when somebody comes back to them.
 */
import type { SessionUser } from "@repo/types";
import type { OtpRequested } from "./auth";
import { api } from "./client";

/**
 * Sets or clears the city on the signed-in account.
 *
 * `null` is a real argument: somebody who picked a city to see its prices and
 * then moved can go back to seeing every city. A settings screen that can only
 * narrow is one people stop using.
 */
export async function setMyCity(cityId: string | null): Promise<SessionUser> {
  return api<SessionUser>("/me/profile", { method: "PATCH", body: { cityId } });
}

export async function setMyName(name: string): Promise<SessionUser> {
  return api<SessionUser>("/me/profile", { method: "PATCH", body: { name } });
}

/** Sends a code to a number the signed-in person wants to add. */
export async function requestMyMobileCode(mobile: string): Promise<OtpRequested> {
  return api<OtpRequested>("/me/mobile/request", { method: "POST", body: { mobile } });
}

/** Proves it and attaches it. Returns the session with the number now on it. */
export async function confirmMyMobile(input: {
  challengeId: string;
  code: string;
}): Promise<SessionUser> {
  return api<SessionUser>("/me/mobile/confirm", { method: "POST", body: input });
}
