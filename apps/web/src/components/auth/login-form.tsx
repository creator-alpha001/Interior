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
import { GoogleSignInButton } from "./google-button";

/**
 * A mobile number, always. Google, optionally, to skip the code next time.
 *
 * Most customers arrive on a phone and will not remember a password for a
 * service they use twice a year, and most vendors are tradespeople who would
 * rather not manage one at all. Staff sign in elsewhere, with a password and an
 * authenticator app — an ops account can see every customer's number and every
 * vendor's margin, so it should not be reachable by whoever ends up with a
 * recycled SIM.
 *
 * Google does not remove the number, and cannot: `users.mobile` is NOT NULL and
 * ops ring every customer about their lead. What it removes is repeating the
 * code. A Google account nobody has linked yet lands in the same OTP stage as
 * everyone else, carrying a link token; after that one code, it is one tap.
 */
export function LoginForm({
  cities = [],
  defaultCityId,
  next,
  askForCity = true,
}: {
  cities?: City[];
  defaultCityId?: string;
  /**
   * Where to land afterwards.
   *
   * Passed down rather than read here with `useSearchParams()`. The page is
   * already a Server Component reading `as` and `mode` off the URL, and it has
   * to be — the audience decides the whole left-hand column — so it resolves
   * the destination too: an explicit `next` the visitor arrived with, else the
   * default for the audience being addressed.
   *
   * Two readers of one URL is how the form and the page come to disagree about
   * where somebody was going, and reading it in a client component costs a
   * Suspense boundary that this form would otherwise need for no other reason.
   */
  next?: string;
  /**
   * Whether the city question belongs on this form.
   *
   * It exists to stop a *new customer* account being created in the wrong city.
   * A vendor signing in already has one on record, put there when ops approved
   * them, so asking again is asking them to re-answer somebody else's question
   * — and the answer would be ignored, since the server only reads it when it
   * is creating an account.
   */
  askForCity?: boolean;
}) {
  const nextPath = next;
  const [stage, setStage] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
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

  /**
   * Fills from `index` onwards with however many digits arrived.
   *
   * One box normally receives one digit, but not always: SMS autofill drops the
   * entire code into the first field, and typing faster than React re-renders
   * lands several in the same one. Handling only the last character — the
   * obvious implementation — silently discards five of the six digits in both
   * cases, and the user sees an empty form for no reason they can work out.
   */
  function fillFrom(index: number, value: string) {
    const digits = value.replace(/\D/g, "").split("");
    if (digits.length === 0) {
      const cleared = [...otp];
      cleared[index] = "";
      setOtp(cleared);
      return;
    }

    // Named for what it is rather than `next`, which is now a prop meaning
    // somewhere entirely different.
    const filled = [...otp];
    digits.slice(0, 6 - index).forEach((digit, offset) => {
      filled[index + offset] = digit;
    });
    setOtp(filled);

    const landed = Math.min(index + digits.length, 5);
    inputs.current[landed]?.focus();
  }

  function verify() {
    if (code.length !== 6 || pending || !challenge.challengeId) return;
    setError(null);

    startTransition(async () => {
      // On success this redirects and never returns.
      const result = await verifyOtpAction({
        challengeId: challenge.challengeId!,
        code,
        // What they typed wins over the Google profile name: somebody
        // correcting it on this screen means it.
        name: name.trim() || undefined,
        // Ignored by the server for an account that already exists, so sending
        // it always is simpler than deciding here whether this is a first
        // sign-in — the server is the only place that actually knows. Omitted
        // entirely when the form never asked, so a hidden default cannot become
        // an answer nobody gave.
        cityId: (askForCity && cityId) || undefined,
        next: nextPath,
      });
      if (result?.error) {
        setError(result.error);
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
      }
    });
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-6 sm:p-8">
      {stage === "mobile" ? (
        <>
          <h2 className="font-display text-[24px]">
            Enter your mobile number
          </h2>
          <p className="mt-2 text-[14.5px] sm:text-[13.5px] text-ink-3">
            We will send a 6-digit code to verify it is you.
          </p>

          <div className="mt-6">
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
                className="h-12 w-full bg-transparent px-2.5 text-[15px] tracking-wide text-ink outline-none placeholder:text-ink-4"
              />
            </div>
          </div>

          {askForCity && cities.length > 0 ? (
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
              Your name{" "}
              <span className="font-normal text-ink-4">— only if this is your first time</span>
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


          <GoogleSignInButton next={nextPath} onError={setError} />

          <p className="mt-6 text-center text-[12.5px] sm:text-[11.5px] leading-relaxed text-ink-4">
            By continuing you agree to our terms and privacy policy. We never share your number with
            professionals.
          </p>
        </>
      ) : (
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

          <h2 className="mt-4 font-display text-[24px]">Enter the code</h2>
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
                  "w-full rounded-lg border bg-paper text-center font-display text-[22px] text-ink outline-none transition-colors",
                  digit ? "border-brand" : "border-line",
                  "focus:border-brand",
                )}
                style={{ height: "3.25rem" }}
              />
            ))}
          </div>

          {error ? (
            <p role="alert" className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger">
              {error}
            </p>
          ) : null}

          <Button onClick={verify} disabled={code.length !== 6 || pending} size="lg" className="mt-5 w-full">
            {pending ? "Verifying…" : "Verify and continue"}
          </Button>

          <p className="mt-4 text-center text-[14px] sm:text-[13px] text-ink-3">
            {seconds > 0 ? (
              <>Resend code in {seconds}s</>
            ) : (
              <button type="button" onClick={sendCode} className="font-medium text-brand">
                Resend code
              </button>
            )}
          </p>

          {challenge.devCode ? (
            <p className="mt-6 rounded-lg bg-surface-2 p-3 text-center text-[13px] sm:text-[12px] leading-relaxed text-ink-3">
              Development only — no SMS was sent. Your code is{" "}
              <span className="font-mono font-semibold text-ink">{challenge.devCode}</span>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
