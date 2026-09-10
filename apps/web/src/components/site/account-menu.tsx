"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui";

/**
 * The header's identity slot.
 *
 * Signed in, this is a menu: there are more account destinations than a navbar
 * has room for, and grouping them keeps the bar scannable.
 *
 * Signed out, it is deliberately *not* a menu. Signing in and signing up are
 * the two things a visitor in that state might want, and both were hidden one
 * click deep behind a control labelled "Sign in" — so the way to create an
 * account was inside the menu you would only open if you already had one. They
 * are two plain controls in the bar now.
 *
 * The professional entrances moved to the sign-in page, where they can be
 * explained. They were two links here that both pointed at `/login`, which is
 * exactly the confusion this component's old comment claimed to prevent.
 */
export function AccountMenu({
  signedInAsClient,
  accountName,
  completingSignIn,
  demoMode,
}: {
  /** Somebody is actually signed in as a customer — not the seeded stand-in. */
  signedInAsClient: boolean;
  /** Their name, so the header says who rather than the word "Account". */
  accountName?: string | null;
  /** A Google sign-in is waiting on a mobile number: no session, but do not
   *  offer to start another one. */
  completingSignIn?: boolean;
  /** No backend configured, so both portals render seed data without signing in. */
  demoMode: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Hooks first, then the branch: a signed-out visitor gets two controls rather
  // than a menu, but this component still owns the slot either way.
  const signedOut = !signedInAsClient && !completingSignIn;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Navigating closes it. Adjusting state during render rather than in an
  // effect, which is React's own guidance and what the header nav does.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (pathname !== renderedPath) {
    setRenderedPath(pathname);
    setOpen(false);
  }

  if (signedOut) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/login"
          className="flex h-11 items-center whitespace-nowrap rounded-full px-3 text-[14.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:text-[13.5px]"
        >
          Sign in
        </Link>
        {/*
          Outlined rather than filled: "Get quotes" is the primary action of the
          whole site and there must be exactly one of those in the bar. This has
          to be findable, not loud.
        */}
        <Link
          href="/login?mode=signup"
          className="flex h-11 items-center whitespace-nowrap rounded-full border border-line-strong px-3.5 text-[14.5px] font-medium text-ink transition-colors hover:border-ink-4 hover:bg-surface-2 sm:text-[13.5px]"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={signedInAsClient ? "Your account" : "Finish signing in"}
        className={cn(
          "flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[14.5px] transition-colors hover:bg-surface-2 hover:text-ink sm:text-[13.5px]",
          open ? "bg-surface-2 text-ink" : "text-ink-2",
        )}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-ink-4" aria-hidden="true">
          <path d="M10 10a3 3 0 100-6 3 3 0 000 6zm0 2c-3 0-6 1.5-6 4v1h12v-1c0-2.5-3-4-6-4z" />
        </svg>
        <span className="hidden lg:inline">
          {signedInAsClient
            ? // The first name, because a header is not the place for "Priya
              // Sharma Kulkarni" and the full name is on the account page.
              (accountName?.trim().split(/\s+/)[0] ?? "Account")
            : "Finishing…"}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[264px] overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]">
          {signedInAsClient ? (
            <Group>
              <Item href="/account" label="My requirements" hint="Quotes, agreements and updates" />
              <Item href="/account/agreements" label="Agreements" />
              <Item href="/account/notifications" label="Notifications" />
              <Item href="/account/support" label="Support" />
            </Group>
          ) : completingSignIn ? (
            // Half-finished: the only useful thing to offer is the way back to
            // the step that is waiting.
            <Group>
              <Item
                href="/welcome"
                label="Finish setting up"
                hint="One number and your account is ready"
                emphasis
              />
            </Group>
          ) : null}

          {/* Only where there is no backend: these are the seed-data walkthrough,
              and saying so is the difference between a preview and a pretence. */}
          {demoMode ? (
            <Group heading="Preview with sample data" divided>
              <Item href="/account" label="Customer account" />
              <Item href="/partner" label="Professional portal" />
            </Group>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Group({
  heading,
  divided,
  children,
}: {
  heading?: string;
  divided?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(divided && "mt-1.5 border-t border-line pt-1.5")}>
      {heading ? (
        <p className="px-3 pb-1 pt-1.5 text-[12px] uppercase tracking-wider text-ink-4 sm:text-[11px]">
          {heading}
        </p>
      ) : null}
      {children}
    </div>
  );
}

function Item({
  href,
  label,
  hint,
  emphasis,
}: {
  href: string;
  label: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <Link href={href} className="block rounded-lg px-3 py-2 transition-colors hover:bg-surface-2">
      <span
        className={cn(
          "block text-[14.5px] sm:text-[13.5px]",
          emphasis ? "font-medium text-brand" : "text-ink-2",
        )}
      >
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-4 sm:text-[11.5px]">
          {hint}
        </span>
      ) : null}
    </Link>
  );
}
