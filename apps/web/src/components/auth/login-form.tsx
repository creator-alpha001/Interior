"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button, cn } from "@repo/ui";
import { requestOtpAction, verifyOtpAction, type OtpState } from "@/app/(site)/login/actions";

/**
 * Mobile OTP is the only route in.
 *
 * Most customers arrive on a phone and will not remember a password for a
 * service they use twice a year, and most vendors are tradespeople who would
 * rather not manage one at all. Staff sign in elsewhere, with a password and an
 * authenticator app — an ops account can see every customer's number and every
 * vendor's margin, so it should not be reachable by whoever ends up with a
 * recycled SIM.
 */
export function LoginForm() {
  const nextPath = useSearchParams().get("next") ?? undefined;
  const [stage, setStage] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [name, setName] = useState("");
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

    const next = [...otp];
    digits.slice(0, 6 - index).forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setOtp(next);

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
        name: name.trim() || undefined,
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
          <h2 className="font-display text-[24px]">Enter your mobile number</h2>
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
