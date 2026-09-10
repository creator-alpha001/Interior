import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listCities } from "@repo/data";
import { Container } from "@repo/ui";
import { pendingGoogleLink } from "@/app/(site)/login/actions";
import { CompleteAccountForm } from "@/components/auth/complete-account-form";
import { getSelectedCity } from "@/lib/city";

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

  // Nothing in progress: either they arrived directly, or the link token
  // expired. Sending them to sign in is the only useful answer.
  if (!pending) redirect("/login");

  /**
   * The header's city is offered as the likely answer, not filled in as a fact.
   *
   * It is a decent guess for somebody who has been browsing, and no guess at
   * all for somebody who arrived straight at a sign-in link — `getSelectedCity`
   * returns null there, so the select stays on "Choose your city" rather than
   * quietly committing them to whichever city happens to sort first.
   */
  const [cities, selectedCity] = await Promise.all([listCities(), getSelectedCity()]);

  return (
    <div className="bg-paper">
      <Container width="default" className="py-14 sm:py-20">
        <div className="mx-auto max-w-lg">
          <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
            Almost there
          </p>
          <h1 className="mt-3 text-[30px] leading-tight sm:text-[36px]">
            Welcome{pending.name ? `, ${pending.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
            Google confirmed <span className="font-medium text-ink">{pending.email}</span>. Two
            questions and your account is ready — and only one of them changes what you see.
          </p>

          <div className="mt-8 rounded-xl border border-line bg-surface p-6 sm:p-8">
            <CompleteAccountForm
              pendingGoogle={pending}
              cities={cities}
              defaultCityId={selectedCity?.id}
            />
          </div>
        </div>
      </Container>
    </div>
  );
}
