"use client";

import { useState, useTransition } from "react";
import type { City } from "@repo/types";
import { Button } from "@repo/ui";
import {
  clearGoogleLinkAction,
  completeGoogleSignUpAction,
  type GoogleState,
} from "@/app/(site)/login/actions";

/**
 * Asking for the last two things before an account is made.
 *
 * This screen used to demand a mobile number and a code before an account
 * existed at all, because `users.mobile` was NOT NULL. Somebody who had just
 * proved who they were to Google was shown a phone field, a Send code button,
 * and no way past either — including no way to simply look at the site they
 * were being asked to hand a phone number to.
 *
 * What it asks now, in order of how much it matters:
 *
 *  - **City.** Asked properly, with the reason attached, because it genuinely
 *    changes what the site can show — prices, professionals and availability
 *    are per city. Skippable all the same: the catalogue treats "not told" as
 *    "show everything", which is a worse experience but an honest one, and the
 *    question comes back later as a prompt rather than a wall.
 *  - **Name.** Prefilled from Google and editable.
 *  - **Mobile.** Not here at all. It is offered by `/welcome/number`, once the
 *    account exists and the session is live, which is what makes it genuinely
 *    optional rather than nominally optional — by the time it is asked for,
 *    closing the tab costs nothing.
 */
export function CompleteAccountForm({
  pendingGoogle,
  cities,
  defaultCityId,
}: {
  pendingGoogle: GoogleState;
  cities: City[];
  defaultCityId?: string;
}) {
  const [name, setName] = useState(pendingGoogle.name ?? "");
  const [cityId, setCityId] = useState(defaultCityId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Creates the account, with or without a city.
   *
   * Both buttons call this. Skipping is not a separate path — it is this one
   * with no city — so it cannot rot into a second-class route that quietly
   * stops working while the happy path stays green. On success the server
   * redirects to the screen that offers a mobile number; this only ever returns
   * in order to report a failure.
   */
  function createAccount(withCity: string | undefined) {
    if (pending) return;
    setError(null);

    startTransition(async () => {
      const result = await completeGoogleSignUpAction({
        name: name.trim() || undefined,
        cityId: withCity,
      });

      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <div>
        <label htmlFor="city" className="text-[14px] font-medium text-ink sm:text-[13px]">
          Where are you?
        </label>
        <select
          id="city"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="mt-2 h-12 w-full rounded-lg border border-line bg-paper px-3 text-[15px] text-ink outline-none transition-colors focus:border-brand"
        >
          <option value="">Choose your city</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
              {city.state ? `, ${city.state}` : ""}
            </option>
          ))}
        </select>

        {/*
          The reason, not the requirement.

          "Your city" with an asterisk teaches somebody that this site collects
          things; the actual consequence — that every price and every vendor on
          the site is per city, so without one they are looking at all of them
          at once — is a reason to answer, and it is true whether or not they do.
        */}
        <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
          Prices, professionals and availability are all set per city. Tell us yours and the site
          shows rates that apply to your job and vendors who can come out to it. Skip and you will
          see every city at once — you can pick one any time from the header.
        </p>
      </div>

      <div className="mt-5">
        <label htmlFor="name" className="text-[14px] font-medium text-ink sm:text-[13px]">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createAccount(cityId || undefined)}
          placeholder="Priya Sharma"
          autoComplete="name"
          className="mt-2 h-12 w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
        />
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger"
        >
          {error}
        </p>
      ) : null}

      <Button
        onClick={() => createAccount(cityId || undefined)}
        disabled={pending}
        size="lg"
        className="mt-6 w-full"
      >
        {pending ? "Setting up…" : "Continue"}
      </Button>

      {/*
        A real second option, not small print.

        Rendered as a button at the same size as the primary one for the same
        reason the copy above gives a reason rather than a rule: if skipping is
        allowed, it should look allowed. A greyed-out link under a full-width
        button reads as the thing you are not supposed to press.
      */}
      {!cityId ? (
        <button
          type="button"
          onClick={() => createAccount(undefined)}
          disabled={pending}
          className="mt-3 h-12 w-full rounded-lg border border-line text-[14.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-60 sm:text-[14px]"
        >
          Skip — show me every city
        </button>
      ) : null}

      <button
        type="button"
        onClick={() =>
          startTransition(async () => {
            await clearGoogleLinkAction();
            window.location.href = "/login";
          })
        }
        className="mt-4 w-full text-center text-[13.5px] text-ink-3 underline hover:text-ink"
      >
        Not {pendingGoogle.email}? Sign in differently
      </button>
    </>
  );
}
