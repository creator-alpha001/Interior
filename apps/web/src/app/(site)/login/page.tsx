import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { pendingGoogleLink } from "./actions";
import { listCities } from "@repo/data";
import { getSelectedCity } from "@/lib/city";
import { Container, cn } from "@repo/ui";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with your mobile number to track your requirements, quotes and projects.",
};

/**
 * One page, three questions answered.
 *
 * It used to answer one: "sign in", framed entirely around a customer. The
 * header offered "Sign in" and "Professional sign in" as separate items that
 * pointed at this same URL and rendered the same thing, so a vendor arriving
 * here read a heading about tracking their quotes and had no way to tell
 * whether they were in the right place. And there was no route marked "sign up"
 * at all — creating an account meant finding "Submit a requirement".
 *
 * The credential is genuinely the same for both audiences: a code to a mobile
 * number, and the account's own role decides where it lands. So the audience
 * switch is not a different sign-in — it is this page saying which of the two
 * it is talking to, sending them onward to the right portal, and offering the
 * registration route that actually belongs to them, which is where the two
 * really do differ.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; as?: string; next?: string }>;
}) {
  // Reading a cookie makes this dynamic, which is correct: a half-finished
  // sign-in is per-person and must never be cached into somebody else's page.
  // A Google sign-in mid-flight belongs on /welcome, not here. Someone landing
  // back on the sign-in page with one pending would otherwise be offered a
  // fresh sign-in while a half-finished one was still waiting.
  if (await pendingGoogleLink()) redirect("/welcome");

  const sp = await searchParams;
  const asProfessional = sp.as === "professional";
  const signingUp = sp.mode === "signup";

  /**
   * The city is asked for here rather than guessed.
   *
   * `actorForMobile` on the server falls back to the first active city when
   * none is given, which is silent and almost always wrong — prices, vendors
   * and availability are all per city, so an account created in the wrong one
   * shows the wrong catalogue and gets matched to professionals who do not work
   * there. The header switcher is prefilled as the likely answer.
   */
  const [cities, selectedCity] = await Promise.all([listCities(), getSelectedCity()]);

  const copy = asProfessional
    ? {
        eyebrow: "Professional portal",
        heading: "Sign in to your professional account",
        blurb:
          "Your leads, quotes, site visits, agreements and commission all live in the portal. The code goes to the mobile number your account is registered against.",
        points: [
          "See qualified leads in the trades you are approved for",
          "Send quotes and track which ones were won",
          "One commission invoice per agreement, never per job",
        ],
      }
    : {
        eyebrow: signingUp ? "Create an account" : "Welcome back",
        heading: signingUp
          ? "Create your account with your mobile number"
          : "Sign in with your mobile number",
        blurb: signingUp
          ? "There is nothing to fill in beyond your number. We send a one-time code, and the account exists the moment you enter it — no password to choose or remember."
          : "Your requirements, quotes, agreements and project updates all live in one place. No password to remember — we send a one-time code to your phone.",
        points: [
          "Compare quotes side by side whenever you like",
          "Track every project through to handover",
          "Message our team about any service",
        ],
      };

  /**
   * Where to land afterwards.
   *
   * Only a default: an explicit `next` from a link the visitor followed wins,
   * so somebody sent here from a product page still goes back to it. The server
   * action validates it against the role's own area regardless, so a customer
   * cannot be walked into the vendor portal by a crafted link.
   */
  const nextPath = sp.next ?? (asProfessional ? "/partner" : undefined);

  return (
    <div className="bg-paper">
      <Container width="default" className="py-14 sm:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div className="lg:pt-2">
            <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
              {copy.eyebrow}
            </p>
            <h1 className="mt-3 text-[34px] leading-tight sm:text-[42px]">{copy.heading}</h1>
            <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-2">{copy.blurb}</p>

            <ul className="mt-8 space-y-3 border-t border-line pt-8">
              {copy.points.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5 text-[15px] sm:text-[14px] text-ink-2"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="mt-1 h-3.5 w-3.5 shrink-0 fill-brand"
                    aria-hidden="true"
                  >
                    <path d="M6.5 11.4L3.3 8.2l1-1 2.2 2.2 5-5 1 1-6 6z" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            {/*
              Two tabs rather than two sign-in pages. The credential is the same
              — the account's role decides the destination — so a second page
              would be the same form under a different heading, and the two
              would drift.
            */}
            <div
              role="tablist"
              aria-label="Who is signing in"
              className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1"
            >
              <AudienceTab
                href={buildHref({ mode: sp.mode, next: sp.next })}
                active={!asProfessional}
                label="I'm a customer"
              />
              <AudienceTab
                href={buildHref({ as: "professional", next: sp.next })}
                active={asProfessional}
                label="I'm a professional"
              />
            </div>

            <LoginForm
              cities={cities}
              defaultCityId={selectedCity?.id}
              next={nextPath}
              intent={asProfessional ? "professional" : undefined}
              /* A vendor's account already has a city; asking again would be
                 asking them to re-answer something ops recorded. */
              askForCity={!asProfessional}
            />

            <div className="mt-5 rounded-xl border border-line bg-surface p-5">
              <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                {asProfessional ? "Not registered with us yet?" : "No account yet?"}
              </p>

              {asProfessional ? (
                <div className="mt-3 space-y-3">
                  <RegisterRow
                    href="/join-as-professional"
                    title="Apply to join as a professional"
                    body="Tell us about your business and the trades you work in. Our team reads every application and rings you back — usually within two working days."
                  />
                  <RegisterRow
                    href="/login"
                    title="Signing in about your own home instead?"
                    body="Customer accounts are separate from professional ones."
                    quiet
                  />
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <RegisterRow
                    href="/login?mode=signup"
                    title="Create an account with your number"
                    body="Enter your mobile above and the account is made when you confirm the code. There is nothing else to fill in."
                    quiet={signingUp}
                  />
                  <RegisterRow
                    href="/submit-requirement"
                    title="Or start by posting a requirement"
                    body="Tell us what you need and we create the account for you as part of it."
                  />
                  <RegisterRow
                    href="/join-as-professional"
                    title="Join as a professional"
                    body="You take the work rather than post it — qualified leads in your trade, commission only on jobs you win."
                    quiet
                  />
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-[12.5px] leading-relaxed text-ink-4">
              Staff accounts sign in with a password, on the ops panel.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}

/** Preserves whichever of the other parameters were set. */
function buildHref(params: { mode?: string; as?: string; next?: string }): string {
  const search = new URLSearchParams();
  if (params.as) search.set("as", params.as);
  if (params.mode) search.set("mode", params.mode);
  if (params.next) search.set("next", params.next);
  const qs = search.toString();
  return qs ? `/login?${qs}` : "/login";
}

function AudienceTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "rounded-lg px-3 py-2.5 text-center text-[14.5px] transition-colors sm:text-[13.5px]",
        active
          ? "bg-brand-soft font-medium text-brand"
          : "text-ink-3 hover:bg-surface-2 hover:text-ink",
      )}
    >
      {label}
    </Link>
  );
}

function RegisterRow({
  href,
  title,
  body,
  quiet,
}: {
  href: string;
  title: string;
  body: string;
  quiet?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-line bg-paper px-3.5 py-3 transition-colors hover:border-ink-4"
    >
      <span
        className={cn(
          "block text-[14.5px] sm:text-[13.5px]",
          quiet ? "text-ink-2" : "font-medium text-ink",
        )}
      >
        {title}
      </span>
      <span className="mt-1 block text-[13px] leading-relaxed text-ink-4 sm:text-[12.5px]">
        {body}
      </span>
    </Link>
  );
}
