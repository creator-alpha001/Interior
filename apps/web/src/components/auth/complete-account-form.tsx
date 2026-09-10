"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { City } from "@repo/types";
import { Button, cn } from "@repo/ui";
import {
  clearGoogleLinkAction,
  requestOtpAction,
  verifyOtpAction,
  type GoogleState,
  type OtpState,
} from "@/app/(site)/login/actions";

/**
 * Finishing an account that Google has already vouched for.
 *
 * Deliberately not the sign-in form with an extra branch. That form's job is to
 * ask a stranger who they are; this one's is to collect the last thing from
 * somebody already identified, and mixing them is what produced a page headed
 * "Sign in with your mobile number" for a person who had just signed in.
 *
 * The OTP mechanics are the same because they are the same act — a code to a
 * number — but the surrounding copy, the absence of a Google button, and the
 * absence of anything offering to sign in all belong to this page.
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
  const [stage, setStage] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState(pendingGoogle.name ?? "");
  const [cityId, setCityId] = useState(defaultCityId ?? cities[0]?.id ?? "");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(0);
  const [challenge, setChallenge] = useState<OtpState>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const mobileValid = /^[0-9]{10}$/.test(mobile);
  const code = otp.join("");

  function sendCode() {
    if (!mobileValid || pending) return;
    setError(null);

    startTransition(async () => {
      const result = await requestOtpAction(mobile);
      if (result.error) {
        setError(result.error);
        return;
      }
      setChallenge(result);
      setStage("otp");
      setSeconds(30);
      setTimeout(() => inputs.current[0]?.focus(), 50);
    });
  }

  /** Same paste and autofill handling as the sign-in form; see the note there. */
  function fillFrom(index: number, value: string) {
    const digits = value.replace(/\D/g, "").split("");
    if (digits.length === 0) {
      const cleared = [...otp];
      cleared[index] = "";
      setOtp(cleared);
      return;
    }

    const next = [...otp];
    digits.slice(0, 6 - index).forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setOtp(next);
    inputs.current[Math.min(index + digits.length, 5)]?.focus();
  }

  function verify() {
    if (code.length !== 6 || pending || !challenge.challengeId) return;
    setError(null);

    startTransition(async () => {
      // Redirects on success and never returns.
      const result = await verifyOtpAction({
        challengeId: challenge.challengeId!,
        code,
        name: name.trim() || pendingGoogle.name || undefined,
        cityId: cityId || undefined,
        linkToken: pendingGoogle.linkToken,
      });
      if (result?.error) {
        setError(result.error);
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
      }
    });
  }

  if (stage === "otp") {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setStage("mobile");
            setError(null);
          }}
          className="text-[14px] sm:text-[13px] text-ink-3 hover:text-ink"
        >
          ← Change number
        </button>

        <h2 className="mt-4 font-display text-[22px]">Enter the code</h2>
        <p className="mt-2 text-[14.5px] sm:text-[13.5px] text-ink-3">
          Sent to <span className="font-medium text-ink">+91 {mobile}</span>
        </p>

        <div className="mt-6 flex gap-2">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={digit}
              onChange={(e) => fillFrom(i, e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                fillFrom(0, e.clipboardData.getData("text"));
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
                if (e.key === "Enter") verify();
              }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              className={cn(
                "h-[3.25rem] w-full rounded-lg border bg-paper text-center font-display text-[22px] text-ink outline-none transition-colors focus:border-brand",
                digit ? "border-brand" : "border-line",
              )}
            />
          ))}
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger">
            {error}
          </p>
        ) : null}

        <Button onClick={verify} disabled={code.length !== 6 || pending} size="lg" className="mt-5 w-full">
          {pending ? "Verifying…" : "Create my account"}
        </Button>

        <p className="mt-4 text-center text-[14px] sm:text-[13px] text-ink-3">
          {seconds > 0 ? (
            <>Resend code in {seconds}s</>
          ) : (
            <button type="button" onClick={sendCode} className="font-medium text-brand">
              Send the code again
            </button>
          )}
        </p>
      </>
    );
  }

  return (
    <>
      <div>
        <label htmlFor="mobile" className="text-[14px] sm:text-[13px] font-medium text-ink">
          Mobile number
        </label>
        <div className="mt-2 flex items-center rounded-lg border border-line bg-paper focus-within:border-brand">
          <span className="pl-3.5 text-[15px] text-ink-4">+91</span>
          <input
            id="mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            onKeyDown={(e) => e.key === "Enter" && sendCode()}
            placeholder="98XXXXXXXX"
            inputMode="numeric"
            autoComplete="tel-national"
            autoFocus
            className="h-12 w-full bg-transparent px-2.5 text-[15px] tracking-wide text-ink outline-none placeholder:text-ink-4"
          />
        </div>
      </div>

      {cities.length > 0 ? (
        <div className="mt-4">
          <label htmlFor="city" className="text-[14px] sm:text-[13px] font-medium text-ink">
            Your city
          </label>
          <select
            id="city"
            value={cityId}
            onChange={(e) => setCityId(e.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-line bg-paper px-3 text-[15px] text-ink outline-none transition-colors focus:border-brand"
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
                {city.state ? `, ${city.state}` : ""}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12.5px] text-ink-4">
            Prices, professionals and availability are all per city.
          </p>
        </div>
      ) : null}

      <div className="mt-4">
        <label htmlFor="name" className="text-[14px] sm:text-[13px] font-medium text-ink">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendCode()}
          placeholder="Priya Sharma"
          autoComplete="name"
          className="mt-2 h-12 w-full rounded-lg border border-line bg-paper px-3.5 text-[15px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand"
        />
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      ) : null}

      <Button onClick={sendCode} disabled={!mobileValid || pending} size="lg" className="mt-5 w-full">
        {pending ? "Sending…" : "Send code"}
      </Button>

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
