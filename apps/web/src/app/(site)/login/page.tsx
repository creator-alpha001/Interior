import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Container } from "@repo/ui";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in with your mobile number to track your requirements, quotes and projects.",
};

export default function LoginPage() {
  return (
    <div className="bg-paper">
      <Container width="default" className="py-14 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
              Welcome back
            </p>
            <h1 className="mt-3 text-[34px] leading-tight sm:text-[42px]">
              Sign in with your mobile number
            </h1>
            <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-2">
              Your requirements, quotes, agreements and project updates all live in one place. No
              password to remember — we send a one-time code to your phone.
            </p>

            <ul className="mt-8 space-y-3 border-t border-line pt-8">
              {[
                "Compare quotes side by side whenever you like",
                "Track every project through to handover",
                "Message our team about any service",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[15px] sm:text-[14px] text-ink-2">
                  <svg
                    viewBox="0 0 16 16"
                    className="mt-1 h-3.5 w-3.5 shrink-0 fill-brand"
                    aria-hidden="true"
                  >
                    <path d="M6.5 11.4L3.3 8.2l1-1 2.2 2.2 5-5 1 1-6 6z" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <LoginForm />
            <p className="mt-4 text-center text-[13.5px] sm:text-[12.5px] text-ink-4">
              New here?{" "}
              <Link href="/submit-requirement" className="font-medium text-brand">
                Submit a requirement
              </Link>{" "}
              — an account is created for you automatically.
            </p>
          </div>
        </div>
      </Container>
    </div>
  );
}
