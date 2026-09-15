import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { pendingGoogleLink } from "@/app/(site)/login/actions";

export const metadata: Metadata = {
  title: "Finish setting up",
  robots: { index: false, follow: false },
};

/**
 * The step between "Google knows who you are" and "you have an account here".
 *
 * Its own page rather than a branch of the sign-in form. On `/login` the state
 * was genuinely ambiguous: the heading beside it still read "Sign in with your
 * mobile number", the header still offered a Sign in link, and nothing said
 * whether the Google sign-in had worked. Somebody who had just authenticated
 * successfully was looking at a page telling them to sign in.
 *
 * There is no session yet, and one press of Continue makes one. That press used
 * to be a mobile number and an SMS code, because `users.mobile` was NOT NULL —
 * so this page, whose entire purpose was to stop somebody feeling stuck after a
 * successful sign-in, ended in a field they could not get past. The number is
 * now asked for on the next screen, after the account exists, where declining
 * costs nothing.
 */
export default async function WelcomePage() {
  const pending = await pendingGoogleLink();
  // Google now always proves a mobile number on WhatsApp before account
  // creation. Keep this legacy route safe for old bookmarks and restored tabs.
  redirect(pending ? "/login?mode=google" : "/login");
}
