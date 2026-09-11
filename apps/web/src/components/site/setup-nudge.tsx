"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import type { City } from "@repo/types";
import { setCityAction } from "@/app/actions";
import { Container, cn } from "@repo/ui";

/**
 * The two questions signup let a customer skip, as one quiet line.
 *
 * This used to be a full card above the hero — a heading, two paragraphs and a
 * button — and it took the whole first screen of the home page for something
 * both halves of which are optional. It is a single strip now: the city is
 * answered in place, the number is a link to the account page where the full
 * form lives, and the whole thing can be put away for the visit.
 *
 * Dismissal lives in `sessionStorage`, as `WhereAreYouPrompt` does: the
 * questions are still genuinely open, so a later visit may ask again — just not
 * for the rest of this one.
 */
const DISMISSED_KEY = "decorashine:setup-nudge-dismissed";

/** Wrapped: a browser set to block site data throws on the read itself. */
function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

const noSubscription = () => () => {};

export function SetupNudge({
  cities,
  needsCity,
  needsNumber,
}: {
  cities: City[];
  needsCity: boolean;
  needsNumber: boolean;
}) {
  const pathname = usePathname();
  const [dismissedNow, setDismissedNow] = useState(false);
  const [pending, startTransition] = useTransition();

  /**
   * Hidden on the server and read from `sessionStorage` on the client, which
   * does not exist on the server. A strip that flashed on hydration and
   * vanished a frame later would be worse than one that appears a frame late.
   */
  const dismissedBefore = useSyncExternalStore(noSubscription, readDismissed, () => true);
  const hidden = dismissedBefore || dismissedNow;

  function dismiss() {
    setDismissedNow(true);
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Blocked storage only costs the strip again on the next page.
    }
  }

  if (hidden || (!needsCity && !needsNumber)) return null;

  return (
    <div className="border-b border-line bg-surface-2">
      <Container
        width="wide"
        className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 text-[13.5px] text-ink-3 sm:text-[13px]"
      >
        <span className="font-medium text-ink-2">Finish setting up</span>

        {needsCity ? (
          <>
            <label htmlFor="setup-city" className="sr-only">
              Your city
            </label>
            <select
              id="setup-city"
              defaultValue=""
              disabled={pending}
              onChange={(event) => {
                const cityId = event.target.value;
                if (!cityId) return;
                // Sets the cookie and the account, then re-renders this route,
                // so the page underneath is already showing that city.
                startTransition(async () => {
                  await setCityAction(cityId, pathname);
                  if (!needsNumber) dismiss();
                });
              }}
              className={cn(
                "h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none transition-colors focus:border-brand",
                pending && "opacity-60",
              )}
            >
              <option value="" disabled>
                Choose your city
              </option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {needsNumber ? (
          <Link href="/account" className="font-medium text-brand hover:underline">
            Add your mobile number
          </Link>
        ) : null}

        <span className="hidden text-ink-4 md:inline">
          Optional — shows prices for your city and lets us reach you about quotes.
        </span>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide for now"
          className="ml-auto grid h-8 w-8 place-items-center rounded-full text-ink-4 transition-colors hover:bg-surface hover:text-ink"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden="true">
            <path d="M3.2 2.2L6 5l2.8-2.8 1 1L7 6l2.8 2.8-1 1L6 7 3.2 9.8l-1-1L5 6 2.2 3.2l1-1z" />
          </svg>
        </button>
      </Container>
    </div>
  );
}
