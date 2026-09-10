"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { City, SessionUser } from "@repo/types";
import { Button, Card } from "@repo/ui";
import { AddMobile } from "@/components/account/add-mobile";
import { setMyCityAction } from "@/app/(site)/account/profile-actions";

/**
 * The permanent home for the two questions signup let somebody skip.
 *
 * The banner on the home page is a nudge and can be dismissed for the session;
 * this is where the answers actually live, so somebody who dismissed the nudge
 * and later changed their mind has somewhere to go. Without it, "you can add
 * this later" would be true of the API and false of the product.
 *
 * Renders nothing when there is nothing outstanding. A settings card that sits
 * there permanently saying "all done" is just another thing to scroll past.
 */
export function FinishSetup({ session, cities }: { session: SessionUser; cities: City[] }) {
  const router = useRouter();
  const [addingNumber, setAddingNumber] = useState(false);
  const [cityId, setCityId] = useState(session.cityId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsCity = !session.cityId;
  const needsNumber = !session.mobile || !session.mobileVerified;

  if (!needsCity && !needsNumber) return null;

  function saveCity(next: string) {
    setCityId(next);
    if (!next) return;
    setError(null);

    startTransition(async () => {
      const result = await setMyCityAction(next);
      if (result.error) {
        setError(result.error);
        // Put the control back where it was, so the screen is not claiming a
        // choice the server refused.
        setCityId(session.cityId ?? "");
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <p className="text-[13px] uppercase tracking-wider text-ink-4 sm:text-[12px]">
        Finish setting up
      </p>
      <h2 className="mt-1.5 font-display text-[22px] text-ink">
        {needsCity && needsNumber
          ? "Two things left, both optional"
          : "One thing left, and it is optional"}
      </h2>

      {needsCity ? (
        <div className="mt-5 border-t border-line pt-5">
          <label htmlFor="account-city" className="text-[14px] font-medium text-ink sm:text-[13px]">
            Your city
          </label>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
            Prices, professionals and availability are all set per city. Until you pick one you are
            seeing every city we cover at once, so the rates on screen may not be the ones that
            apply to your job.
          </p>
          <select
            id="account-city"
            value={cityId}
            disabled={pending}
            onChange={(e) => saveCity(e.target.value)}
            className="mt-3 h-12 w-full rounded-lg border border-line bg-paper px-3 text-[15px] text-ink outline-none transition-colors focus:border-brand"
          >
            <option value="">Choose your city</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
                {city.state ? `, ${city.state}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {needsNumber ? (
        <div className="mt-5 border-t border-line pt-5">
          {addingNumber ? (
            <AddMobile
              onDone={() => {
                setAddingNumber(false);
                router.refresh();
              }}
              onSkip={() => setAddingNumber(false)}
              skipLabel="Cancel"
              autoFocus
            />
          ) : (
            <>
              <p className="text-[14px] font-medium text-ink sm:text-[13px]">
                {session.mobile ? "Confirm your mobile number" : "Add a mobile number"}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                {session.mobile
                  ? "We have a number on file but you have not confirmed it. One code and we know we can reach you about your quotes."
                  : "It lets our team ring you about your quotes rather than waiting on email. It is never given to a professional."}
              </p>
              <Button
                onClick={() => setAddingNumber(true)}
                variant="secondary"
                className="mt-3"
              >
                {session.mobile ? "Confirm my number" : "Add my number"}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
