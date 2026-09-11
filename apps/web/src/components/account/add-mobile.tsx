"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { OtpChannel } from "@repo/data";
import { Button, cn } from "@repo/ui";
import {
  confirmMyMobileAction,
  requestMyMobileCodeAction,
  type MobileCodeState,
} from "@/app/(site)/account/profile-actions";
import { OtherChannelButton, sentVia } from "@/components/auth/otp-channel";

/**
 * Adding a mobile number to an account that already exists, and proving it.
 *
 * One component, used both by the last step of signing up and by the account
 * screen afterwards, because they are the same act and the account exists by
 * the time either runs. Written once deliberately: the version that gets used
 * twice a year is the one that quietly stops handling a resend, and "verify
 * your number" failing silently is the kind of bug nobody reports.
 *
 * Nothing here is required. Every state has a way out that does not involve
 * giving a number — `onSkip` is rendered as an equal option rather than as
 * small print, because a number this business would like is not a number this
 * person owes it.
 */
export function AddMobile({
  onDone,
  onSkip,
  skipLabel = "Not now",
  submitLabel = "Save my number",
  autoFocus = false,
}: {
  onDone: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [stage, setStage] = useState<"mobile" | "otp">("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(0);
  const [challenge, setChallenge] = useState<MobileCodeState>({});
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

  /** `channel` omitted means WhatsApp. A resend keeps the channel it was on. */
  function sendCode(channel?: OtpChannel) {
    if (!mobileValid || pending) return;
    setError(null);

    startTransition(async () => {
      const result = await requestMyMobileCodeAction(mobile, channel);
      if (result.error) {
        setError(result.error);
        return;
      }
      // A new code retires the last one, so digits typed from it are now wrong.
      setOtp(["", "", "", "", "", ""]);
      setChallenge(result);
      setStage("otp");
      setSeconds(30);
      setTimeout(() => inputs.current[0]?.focus(), 50);
    });
  }

  /**
   * Accepts a pasted or autofilled code in any box, not just the first.
   *
   * Android's SMS autofill drops the whole six digits into whichever input has
   * focus, so treating each box as one character loses five of them.
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
    inputs.current[Math.min(index + digits.length, 5)]?.focus();
  }

  function verify() {
    if (code.length !== 6 || pending || !challenge.challengeId) return;
    setError(null);

    startTransition(async () => {
      const result = await confirmMyMobileAction({
        challengeId: challenge.challengeId!,
        code,
      });

      if (result.error) {
        setError(result.error);
        setOtp(["", "", "", "", "", ""]);
        inputs.current[0]?.focus();
        return;
      }

      onDone();
    });
  }

  if (stage === "otp") {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setStage("mobile");
            setError(null);
          }}
          className="text-[14px] text-ink-3 hover:text-ink sm:text-[13px]"
        >
          ← Change number
        </button>

        <p className="mt-4 text-[14.5px] text-ink-3 sm:text-[13.5px]">
          {`We sent a code ${sentVia(challenge.channel)}to`}{" "}
          <span className="font-medium text-ink">+91 {mobile}</span>
        </p>

        {challenge.devCode ? (
          <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-3">
            Development build — the code is{" "}
            <span className="font-medium text-ink">{challenge.devCode}</span>
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
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
          <p
            role="alert"
            className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger"
          >
            {error}
          </p>
        ) : null}

        <Button
          onClick={verify}
          disabled={code.length !== 6 || pending}
          size="lg"
          className="mt-5 w-full"
        >
          {pending ? "Verifying…" : submitLabel}
        </Button>

        <div className="mt-4 flex items-center justify-between text-[14px] text-ink-3 sm:text-[13px]">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {seconds > 0 ? (
              <span>Resend code in {seconds}s</span>
            ) : (
              <button
                type="button"
                onClick={() => sendCode(challenge.channel)}
                className="font-medium text-brand"
              >
                Send the code again
              </button>
            )}
            <OtherChannelButton channel={challenge.channel} disabled={pending} onSwitch={sendCode} />
          </span>

          {onSkip ? (
            <button type="button" onClick={onSkip} className="hover:text-ink">
              {skipLabel}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor="add-mobile" className="text-[14px] font-medium text-ink sm:text-[13px]">
        Mobile number
      </label>
      <div className="mt-2 flex items-center rounded-lg border border-line bg-paper focus-within:border-brand">
        <span className="pl-3.5 text-[15px] text-ink-4">+91</span>
        <input
          id="add-mobile"
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
          onKeyDown={(e) => e.key === "Enter" && sendCode()}
          placeholder="98XXXXXXXX"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          className="h-12 w-full bg-transparent px-2.5 text-[15px] tracking-wide text-ink outline-none placeholder:text-ink-4"
        />
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-4">
        We send one code on WhatsApp, or by SMS if you would rather, to check it is yours. It is how we ring you about your quotes, and it is
        never given to a professional.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger-soft px-3 py-2.5 text-[13.5px] text-danger"
        >
          {error}
        </p>
      ) : null}

      <Button
        onClick={() => sendCode()}
        disabled={!mobileValid || pending}
        size="lg"
        className="mt-4 w-full"
      >
        {pending ? "Sending…" : "Send code"}
      </Button>

      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 w-full text-center text-[13.5px] text-ink-3 underline hover:text-ink"
        >
          {skipLabel}
        </button>
      ) : null}
    </div>
  );
}
