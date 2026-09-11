"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import type { City } from "@repo/types";
import { setCityAction } from "@/app/actions";
import { Container, cn } from "@repo/ui";

/**
 * The two questions signup let a customer skip, as one highlighted strip.
 *
 * It was once a full card above the hero — a heading, two paragraphs and a
 * button — which took the whole first screen. It then became a grey line so
 * quiet it was easy to miss. This is the middle: still one strip, but in the
 * accent colour with an icon and a filled button, because a number the team can
 * ring about quotes is worth being noticed even though it is optional.
 *
 * The city is answered in place; the number goes to the account page, where the
 * form to add and confirm it lives. Dismissal lasts for the visit and lives in
 * `sessionStorage`, as `WhereAreYouPrompt` does: the questions are still
 * genuinely open, so a later visit may ask again.
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

  const headline =
    needsNumber && needsCity
      ? "Add your mobile number and city"
      : needsNumber
        ? "Add your mobile number"
        : "Choose your city";
  const reason = needsNumber
    ? "So our team can call you about your quotes. It is never shared with professionals."
    : "So prices and professionals match where you live.";

  return (
    <div className="border-b border-clay-line bg-clay-soft">
      <Container
        width="wide"
        className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-clay text-white"
            aria-hidden="true"
          >
            {needsNumber ? (
              <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                <path d="M6.6 2.5l2 3.2c.3.5.2 1.1-.2 1.5L7.2 8.4a9.3 9.3 0 004.4 4.4l1.2-1.2c.4-.4 1-.5 1.5-.2l3.2 2c.5.3.7 1 .5 1.5l-.6 1.6c-.3.8-1.1 1.3-2 1.2C8.9 17.2 2.8 11.1 2.3 4.6c-.1-.9.4-1.7 1.2-2l1.6-.6c.5-.2 1.2 0 1.5.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current">
                <path d="M8 1a4.5 4.5 0 00-4.5 4.5C3.5 9 8 15 8 15s4.5-6 4.5-9.5A4.5 4.5 0 008 1zm0 6.2a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4z" />
              </svg>
            )}
          </span>
          <p className="min-w-0 text-[14.5px] leading-snug text-ink-2 sm:text-[14px]">
            <span className="font-semibold text-ink">{headline}</span>
            <span className="hidden text-ink-3 md:inline"> — {reason}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
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
                  "h-10 rounded-full border border-clay-line bg-surface px-3.5 text-[14px] text-ink outline-none transition-colors focus:border-clay sm:h-9 sm:text-[13.5px]",
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
            <Link
              href="/account"
              className="inline-flex h-10 items-center whitespace-nowrap rounded-full bg-clay px-4 text-[14px] font-medium text-white transition-[filter] hover:brightness-95 sm:h-9 sm:text-[13.5px]"
            >
              Add mobile number
            </Link>
          ) : null}

          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-10 items-center rounded-full px-3 text-[14px] text-ink-3 transition-colors hover:bg-white/60 hover:text-ink sm:h-9 sm:text-[13.5px]"
          >
            Not now
          </button>
        </div>
      </Container>
    </div>
  );
}
