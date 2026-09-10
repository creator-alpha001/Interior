"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import type { City } from "@repo/types";
import { setCityAction } from "@/app/actions";
import { Container, cn } from "@repo/ui";

/**
 * Asks a signed-in person where they are, and says why it is worth answering.
 *
 * The reason is the whole component. "Set your city" on its own is a chore
 * somebody dismisses; the specific consequence — that the prices and the
 * professionals on the page underneath are currently from everywhere, so none
 * of them is quite an answer to their job — is a reason to spend the two
 * seconds. It is the same sentence the signup screen uses, deliberately: being
 * told one thing at signup and a different thing later is how a prompt starts
 * reading as a trick.
 *
 * Dismissible, and it stays dismissed. Being asked once is a prompt; being
 * asked again on every visit is the wall this change exists to remove, rebuilt
 * out of a banner. The dismissal lives in `sessionStorage` rather than the
 * account: the question is still genuinely open, so a later visit may ask again
 * — just not for the rest of this one.
 */
const DISMISSED_KEY = "interiobee:where-are-you-dismissed";

export function WhereAreYouPrompt({ cities }: { cities: City[] }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);
  const [pending, startTransition] = useTransition();

  /**
   * Rendered hidden and revealed on the client, rather than read during render.
   *
   * `sessionStorage` does not exist on the server, and a banner that appears on
   * hydration and vanishes a frame later is worse than one that fades in a
   * frame late. Wrapped because a browser set to block site data throws on the
   * read itself rather than returning null.
   */
  useEffect(() => {
    try {
      setHidden(window.sessionStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Blocked storage only costs them the prompt again next page. Not worth
      // an error, and there is nothing useful to do about it.
    }
  }

  if (hidden) return null;

  return (
    <div className="border-b border-line bg-surface-2">
      <Container width="wide" className="py-3.5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[14px] leading-relaxed text-ink-2 sm:text-[13.5px]">
            <span className="font-medium text-ink">Where are you?</span> You are seeing prices and
            professionals from every city we cover. Pick yours and the whole site narrows to rates
            that apply to your job and vendors who can actually come out to it.
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="where-are-you" className="sr-only">
              Your city
            </label>
            <select
              id="where-are-you"
              defaultValue=""
              disabled={pending}
              onChange={(e) => {
                const cityId = e.target.value;
                if (!cityId) return;
                // The action sets a cookie, which re-renders this route — so the
                // page behind the banner is already showing the chosen city by
                // the time it disappears.
                startTransition(async () => {
                  await setCityAction(cityId, pathname);
                  dismiss();
                });
              }}
              className={cn(
                "h-10 rounded-lg border border-line bg-paper px-3 text-[14px] text-ink outline-none transition-colors focus:border-brand sm:text-[13.5px]",
                pending && "opacity-60",
              )}
            >
              <option value="" disabled>
                Choose your city
              </option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                  {city.state ? `, ${city.state}` : ""}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={dismiss}
              className="h-10 rounded-lg px-3 text-[14px] text-ink-3 transition-colors hover:text-ink sm:text-[13.5px]"
            >
              Not now
            </button>
          </div>
        </div>
      </Container>
    </div>
  );
}
