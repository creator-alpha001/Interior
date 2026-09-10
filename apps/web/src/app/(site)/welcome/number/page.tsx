import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@repo/data";
import { Container } from "@repo/ui";
import { OptionalNumberStep } from "@/components/auth/optional-number-step";

export const metadata: Metadata = {
  title: "Add your number",
  robots: { index: false, follow: false },
};

/**
 * The last screen of signing up, and the first one that is genuinely optional.
 *
 * Its own route rather than a second stage inside the welcome form, because by
 * the time somebody gets here the account exists and the session is live. A
 * reload, a restored tab or a back button has to land on something true — and
 * "the signup screen for an account you already have" is not.
 *
 * That is also what makes the number optional in more than name. There is
 * nothing left to lose by closing the tab: the account is made, the session is
 * set, and both buttons on this page go to the same place.
 */
export default async function WelcomeNumberPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, { next }] = await Promise.all([getSessionUser(), searchParams]);

  // No session: they arrived here directly, or signed out in another tab.
  if (!session) redirect("/login");

  // Already has a proved number — there is nothing to ask for. Somebody who
  // wants to change it does so from their account, not from a signup screen.
  if (session.mobile && session.mobileVerified) redirect(destinationFor(session.actor.role, next));

  return (
    <div className="bg-paper">
      <Container width="default" className="py-14 sm:py-20">
        <div className="mx-auto max-w-lg">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay sm:text-[11px]">
            You&rsquo;re in
          </p>
          <h1 className="mt-3 text-[30px] leading-tight sm:text-[36px]">
            Welcome{session.name ? `, ${session.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
            Your account is ready and you can start browsing right now. One optional extra: a mobile
            number lets our team ring you about your quotes rather than waiting on email. It is
            never given to a professional, and you can add it later from your account instead.
          </p>

          <div className="mt-8 rounded-xl border border-line bg-surface p-6 sm:p-8">
            <OptionalNumberStep destination={destinationFor(session.actor.role, next)} />
          </div>
        </div>
      </Container>
    </div>
  );
}

/**
 * Where to go next, without trusting the query string.
 *
 * `next` arrives in a URL, so it is only ever accepted as a path on this site
 * inside the area the person's role belongs to. Without that check a phishing
 * link could send somebody through a genuine signup and straight out to another
 * domain — the same rule the sign-in actions apply, restated here because this
 * is a second entry point for the same value.
 */
function destinationFor(role: string, next?: string): string {
  const home = role === "professional" ? "/partner" : "/account";

  if (next?.startsWith("/") && !next.startsWith("//") && next.startsWith(home)) {
    return next;
  }
  return home;
}
