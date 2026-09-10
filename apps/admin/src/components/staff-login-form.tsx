"use client";

import { useState, useTransition } from "react";
import { staffLoginAction } from "@/app/login/actions";

/**
 * Email, password, and an authenticator code where the account has one.
 *
 * The TOTP field is always present rather than appearing after a first attempt.
 * Revealing it only once the password was accepted would tell an attacker their
 * password was right, which is precisely the signal a second factor exists to
 * withhold.
 */
export function StaffLoginForm({ wrongRole }: { wrongRole?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function submit() {
    if (pending || !email.trim() || !password) return;
    setError(undefined);
    startTransition(async () => {
      const result = await staffLoginAction({ email, password, totp });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="w-full max-w-sm rounded-xl border border-line bg-surface p-6"
    >
      <h1 className="font-display text-[24px] text-ink">Decora Shine Ops</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
        Staff only. Customers and professionals sign in on the main site with a code to their
        mobile.
      </p>

      {wrongRole ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-danger-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-danger"
        >
          That account is signed in, but it is not a staff account. Sign in with your ops
          credentials.
        </p>
      ) : null}

      <label htmlFor="email" className="mt-5 block text-[12.5px] font-medium text-ink">
        Work email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-md border border-line bg-paper px-3 text-[13px] text-ink outline-none transition-colors focus:border-brand"
      />

      <label htmlFor="password" className="mt-4 block text-[12.5px] font-medium text-ink">
        Password
      </label>
      <input
        id="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-md border border-line bg-paper px-3 text-[13px] text-ink outline-none transition-colors focus:border-brand"
      />

      <label htmlFor="totp" className="mt-4 block text-[12.5px] font-medium text-ink">
        Authenticator code <span className="font-normal text-ink-4">— if your account has one</span>
      </label>
      <input
        id="totp"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={totp}
        onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="mt-1.5 h-10 w-full rounded-md border border-line bg-paper px-3 text-[13px] tracking-[0.3em] text-ink outline-none transition-colors placeholder:tracking-normal placeholder:text-ink-4 focus:border-brand"
      />

      {error ? (
        <p role="alert" className="mt-4 rounded-md bg-danger-soft px-3 py-2.5 text-[12.5px] text-danger">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || !email.trim() || !password}
        className="mt-5 h-10 w-full rounded-md bg-brand text-[13px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
