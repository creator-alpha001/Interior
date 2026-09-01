"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, cn } from "@repo/ui";

/**
 * Mobile OTP is the primary route, since most customers arrive on a phone and
 * will not remember a password for a service they use twice a year.
 *
 * This is the front end only — no OTP is actually sent. The code field accepts
 * any six digits so the flow can be walked end to end before auth is wired up.
 */
export function LoginForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(0);
  const [pending, setPending] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function sendCode() {
    if (!/^[0-9]{10}$/.test(mobile)) return;
    setStage("otp");
    setSeconds(30);
    setTimeout(() => inputs.current[0]?.focus(), 50);
  }

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  }

  function verify() {
    if (otp.join("").length !== 6) return;
    setPending(true);
    // Front end only — the demo account is what the account area renders.
    setTimeout(() => router.push("/account"), 500);
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

          <Button
            onClick={sendCode}
            disabled={!/^[0-9]{10}$/.test(mobile)}
            size="lg"
            className="mt-5 w-full"
          >
            Send code
          </Button>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[13px] sm:text-[12px] text-ink-4">or</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={() => router.push("/account")}
            className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface text-[15px] sm:text-[14px] font-medium text-ink transition-colors hover:bg-surface-2"
          >
            <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 01-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 009 18z"
              />
              <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 010-3.4V5H.9a9 9 0 000 8l3-2.3z" />
              <path
                fill="#EA4335"
                d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.3A9 9 0 00.9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="mt-6 text-center text-[12.5px] sm:text-[11.5px] leading-relaxed text-ink-4">
            By continuing you agree to our terms and privacy policy. We never share your number with
            professionals.
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setStage("mobile")}
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
                onChange={(e) => setDigit(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !otp[i] && i > 0) inputs.current[i - 1]?.focus();
                  if (e.key === "Enter") verify();
                }}
                inputMode="numeric"
                maxLength={1}
                aria-label={`Digit ${i + 1}`}
                className={cn(
                  "h-13 w-full rounded-lg border bg-paper text-center font-display text-[22px] text-ink outline-none transition-colors",
                  digit ? "border-brand" : "border-line",
                  "focus:border-brand",
                )}
                style={{ height: "3.25rem" }}
              />
            ))}
          </div>

          <Button
            onClick={verify}
            disabled={otp.join("").length !== 6 || pending}
            size="lg"
            className="mt-5 w-full"
          >
            {pending ? "Verifying…" : "Verify and continue"}
          </Button>

          <p className="mt-4 text-center text-[14px] sm:text-[13px] text-ink-3">
            {seconds > 0 ? (
              <>Resend code in {seconds}s</>
            ) : (
              <button
                type="button"
                onClick={() => setSeconds(30)}
                className="font-medium text-brand"
              >
                Resend code
              </button>
            )}
          </p>

          <p className="mt-6 rounded-lg bg-surface-2 p-3 text-center text-[13px] sm:text-[12px] leading-relaxed text-ink-3">
            Prototype — no code is actually sent. Enter any six digits to continue.
          </p>
        </>
      )}
    </div>
  );
}
