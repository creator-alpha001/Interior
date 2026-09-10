"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  ApiError,
  SESSION_COOKIE,
  completeGoogleSignUp,
  requestOtp,
  signInWithGoogle,
  signOut,
  verifyOtp,
} from "@repo/data";

/**
 * Sign-in runs as server actions rather than fetches from the browser.
 *
 * The session cookie is httpOnly, so only a server response can set it; and
 * keeping the API's address out of the browser means the backend never needs a
 * public origin or a CORS policy.
 */

export interface OtpState {
  challengeId?: string;
  expiresInSeconds?: number;
  /** Shown in development only, when the API echoes the code instead of texting it. */
  devCode?: string;
  error?: string;
}

export async function requestOtpAction(mobile: string): Promise<OtpState> {
  try {
    const result = await requestOtp(mobile);
    return {
      challengeId: result.challengeId,
      expiresInSeconds: result.expiresInSeconds,
      devCode: result.devCode,
    };
  } catch (error) {
    return { error: messageFor(error, "We could not send a code just now.") };
  }
}

/**
 * Copies the API's session cookie onto this domain.
 *
 * Shared by both sign-in paths. Written once because the alternative is two
 * copies of "set an httpOnly cookie", and the copy that drifts is the one that
 * silently stops marking it `secure`.
 */
async function adoptSession(setCookie: string | null): Promise<void> {
  if (!setCookie) return;

  // Parsed only far enough to hand the value to Next's cookie store; the
  // attributes the API set are reapplied rather than reinvented.
  const [pair] = setCookie.split(";");
  const [name, ...rest] = (pair ?? "").split("=");
  if (!name || rest.length === 0) return;

  (await cookies()).set({
    name: name.trim(),
    value: rest.join("="),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/**
 * Points browsing at a city, or stops pointing it anywhere.
 *
 * The catalogue reads this cookie rather than the account, because it has to
 * work for people who are not signed in — prices, professionals and
 * availability are all per city. Without it somebody could sign up in Lucknow
 * and go straight back to a Bengaluru catalogue, which is the "results should
 * match my location" failure rather than a cosmetic one.
 *
 * Passing null deletes it, and that case matters as much as setting one. A
 * person who declines to give a city has asked to see everything; a cookie left
 * over from before they signed in would quietly narrow the catalogue to a city
 * they never picked and never mention it.
 */
export async function applyCityCookie(cityId: string | null): Promise<void> {
  const jar = await cookies();

  if (!cityId) {
    jar.delete("city");
    /*
     * A marker, because deleting a cookie cannot express a choice.
     *
     * "No city cookie" is the state of every first-time visitor, so on its own
     * it cannot also mean "I deliberately want every city" — a signed-in person
     * choosing All cities would fall through to whatever their account says and
     * watch the header change straight back. This says which of the two it is.
     */
    jar.set({
      name: "city_cleared",
      value: "1",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return;
  }

  jar.delete("city_cleared");
  jar.set({
    name: "city",
    value: cityId,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

/**
 * Where to send somebody once they are in.
 *
 * `next` is only ever a path on this site, and only one inside the area their
 * role belongs to. An open redirect here would let a phishing link send
 * somebody through a genuine sign-in and straight out to another domain.
 */
/**
 * Who the person said they were when they started signing in.
 *
 * Only "professional" is worth carrying: it is the one choice that can turn out
 * to be wrong about the account behind the number.
 */
export type SignInIntent = "professional" | undefined;

function destinationFor(role: string, next?: string, intent?: SignInIntent): string {
  /**
   * Asked for the portal, but this number is not a vendor.
   *
   * This case used to be silent, and silence made the professional tab a lie:
   * `next` was `/partner`, the check below rejected it because it does not
   * start with `/account`, and the person landed in the customer account with
   * no word about why. They had just told us they were a professional.
   *
   * Being signed in is still correct — they proved the number, and the account
   * behind it is real. What was missing is the answer to the question they
   * actually asked, so they are sent to the one screen that gives it: this
   * number is not registered as a professional, and here is how to apply.
   *
   * The role itself is never negotiable here. It comes from the session, which
   * comes from the database; nothing a browser sends can grant it.
   */
  if (intent === "professional" && role !== "professional") {
    // Inline rather than a shared const: a "use server" module may only export
    // async functions, so a exported string here breaks the build for every
    // route that imports this file — which is most of them.
    return "/account/become-a-professional?from=signin";
  }

  /**
   * The area this role owns, used only to vet `next`.
   *
   * An open redirect here would let a phishing link send somebody through a
   * genuine sign-in and straight out to another domain, so `next` is honoured
   * only when it points inside the caller's own area.
   */
  const area = role === "professional" ? "/partner" : "/account";

  if (next?.startsWith("/") && !next.startsWith("//") && next.startsWith(area)) {
    return next;
  }

  /**
   * Where they land when nothing said otherwise — deliberately not `area`.
   *
   * A vendor's work is the portal, so that stays. A customer's was `/account`,
   * which is the worst page on the site to arrive at: for anybody who has just
   * created an account it is three zeroes and an empty list. Signing in ended
   * on a dead end, and the catalogue, the packages and the professionals — the
   * things there are actually to do — were a click away behind a nav item.
   *
   * The home page carries their requirements and the setup prompts at the top
   * for exactly this reason, so nothing is lost by landing there instead.
   */
  return role === "professional" ? "/partner" : "/";
}

export async function verifyOtpAction(input: {
  challengeId: string;
  code: string;
  name?: string;
  /**
   * Where they are. Used only when the account is being created.
   *
   * Sent on every verification rather than only on a first sign-in, because
   * the client cannot tell which this is — the server is the only place that
   * knows whether the number is already an account, and it ignores this for
   * one that is.
   */
  cityId?: string;
  /** Present only on the code that completes a first Google sign-in. */
  linkToken?: string;
  /** Where they were headed before being sent to sign in. */
  next?: string;
  /** Which sign-in they chose. See `destinationFor`. */
  intent?: SignInIntent;
}): Promise<{ error: string } | never> {
  let destination: string;

  try {
    const { actor, setCookie } = await verifyOtp(input);
    await adoptSession(setCookie);

    // Browsing follows the city they just chose. See `applyCityCookie`.
    if (input.cityId) await applyCityCookie(input.cityId);

    // Whether or not this carried a link token: the sign-in is over either way,
    // and leaving the cookie behind would offer to resume a finished one.
    await forgetGoogleLink();
    destination = destinationFor(actor.role, input.next, input.intent);
  } catch (error) {
    return { error: messageFor(error, "That code did not work.") };
  }

  redirect(destination);
}

/**
 * Where a half-finished Google sign-in is kept.
 *
 * It used to live only in React state, which meant a reload — or the browser
 * restoring the tab, or anything at all that remounted the page — threw the
 * link token away and dropped the person back to the start with no way to
 * finish. They had proved who they were to Google and the site had forgotten.
 *
 * httpOnly, because it carries the signed token that says which Google account
 * this is; short-lived, because the token behind it expires in fifteen minutes
 * and a stale cookie would offer to finish a sign-in that can no longer be
 * finished.
 */
const GOOGLE_LINK_COOKIE = "interiobee_google_link";
const GOOGLE_LINK_TTL_SECONDS = 15 * 60;

async function rememberGoogleLink(state: GoogleState): Promise<void> {
  (await cookies()).set({
    name: GOOGLE_LINK_COOKIE,
    value: Buffer.from(JSON.stringify(state), "utf8").toString("base64url"),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GOOGLE_LINK_TTL_SECONDS,
  });
}

async function forgetGoogleLink(): Promise<void> {
  (await cookies()).delete(GOOGLE_LINK_COOKIE);
}

/**
 * The pending Google sign-in, if there is one. Read by the login page so a
 * reload resumes where it was rather than starting again.
 */
export async function pendingGoogleLink(): Promise<GoogleState | null> {
  const raw = (await cookies()).get(GOOGLE_LINK_COOKIE)?.value;
  if (!raw) return null;

  try {
    const state = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as GoogleState;
    return state.linkToken ? state : null;
  } catch {
    // A malformed cookie is not worth an error page; starting over is the
    // right outcome and the only one available.
    return null;
  }
}

/**
 * Abandons a half-finished Google sign-in.
 *
 * Signing in with the wrong Google account is an easy mistake on a shared
 * machine, and without this the login page would go on insisting on a number
 * for that account until the token expired a quarter of an hour later.
 */
export async function clearGoogleLinkAction(): Promise<void> {
  await forgetGoogleLink();
}

export interface GoogleState {
  /** Set when this Google account has no account here yet. */
  linkToken?: string;
  email?: string;
  name?: string;
  /**
   * Where they were headed before signing in.
   *
   * Carried through the cookie rather than the URL because the welcome screen
   * is reached by a redirect, and a person who pressed "Continue with Google"
   * from a product page should land back on it rather than on a generic
   * account page.
   */
  next?: string;
  /** Which sign-in they chose, so finishing one keeps the answer. */
  intent?: SignInIntent;
  error?: string;
}

/**
 * Signs in with a Google ID token the browser obtained.
 *
 * Returns rather than redirects when there is no account yet, because there is
 * a step left — though a much smaller one than there used to be. It asked for a
 * mobile number and would not continue without one; now it asks where somebody
 * is, says why that matters, and takes "not now" for an answer.
 */
export async function googleSignInAction(
  idToken: string,
  next?: string,
  intent?: SignInIntent,
): Promise<GoogleState | never> {
  let destination: string;

  try {
    const result = await signInWithGoogle(idToken);

    if (result.status === "profile_required") {
      await rememberGoogleLink({
        linkToken: result.linkToken,
        email: result.email,
        name: result.name,
        next,
        intent,
      });
      // Off the sign-in page entirely. Staying there left somebody who had just
      // authenticated looking at a heading telling them to sign in, beside a
      // header still offering a Sign in link — a state with no way to tell
      // whether Google had worked.
      destination = "/welcome";
      return redirect(destination);
    }

    await adoptSession(result.setCookie);
    destination = destinationFor(result.actor.role, next, intent);
  } catch (error) {
    return { error: messageFor(error, "That Google sign-in did not work.") };
  }

  redirect(destination);
}

/**
 * Finishes a first Google sign-in, with or without a city.
 *
 * The one action behind both buttons on the welcome screen. "Continue" sends
 * the city that was picked; "I will choose later" sends the same call with no
 * city at all — deliberately the same code path, so skipping cannot rot into a
 * second-class route that quietly stops working.
 */
export async function completeGoogleSignUpAction(input: {
  name?: string;
  cityId?: string;
}): Promise<{ error: string } | never> {
  const pending = await pendingGoogleLink();
  if (!pending?.linkToken) {
    // The link token expired, or this is a stale tab. Starting again is the
    // only thing left, and it is one press.
    redirect("/login");
  }

  let destination: string;

  try {
    const { actor, setCookie } = await completeGoogleSignUp({
      linkToken: pending.linkToken,
      name: input.name?.trim() || pending.name || undefined,
      cityId: input.cityId || undefined,
    });

    await adoptSession(setCookie);

    /**
     * Browsing follows the city they just chose — and stops following one when
     * they chose none.
     *
     * The catalogue reads this cookie rather than the account, because it also
     * has to work for people who are not signed in. Clearing it matters as much
     * as setting it: a stale cookie from before they signed in would quietly
     * filter the catalogue to a city they never picked, which is the same
     * silent-wrong-city bug in a different place.
     */
    await applyCityCookie(input.cityId || null);
    await forgetGoogleLink();

    /**
     * The number is asked for on the next screen, not this one.
     *
     * A real route rather than a second stage held in component state, because
     * the account exists from this moment: a reload, a restored tab or a back
     * button must not land somebody on a signup screen for an account they
     * already have. `next` rides along so somebody who pressed "Continue with
     * Google" from a product page still ends up back on it.
     */
    /*
     * A first Google sign-up always creates a customer — `createClientForIdentity`
     * is the only thing it can call. So somebody who came in through the
     * professional tab is told so here too, rather than discovering it by
     * ending up somewhere they did not ask for.
     */
    const onward = destinationFor(actor.role, pending.next, pending.intent);
    destination = `/welcome/number?next=${encodeURIComponent(onward)}`;
  } catch (error) {
    return { error: messageFor(error, "We could not finish setting up your account.") };
  }

  redirect(destination);
}

export async function signOutAction(): Promise<never> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  await signOut(token ? `${SESSION_COOKIE}=${token}` : undefined);
  store.delete(SESSION_COOKIE);

  redirect("/");
}

function messageFor(error: unknown, fallback: string): string {
  // The API writes messages meant to be read by the person who caused them —
  // "That code is not right, or it has expired" — so pass them through rather
  // than replacing them with something vaguer.
  if (error instanceof ApiError && error.isClientError) return error.message;
  return fallback;
}
