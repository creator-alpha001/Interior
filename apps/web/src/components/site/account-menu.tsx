"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui";

/**
 * One slot in the header for everything to do with who you are.
 *
 * There are more identity destinations than a navbar has room for — customers
 * sign in, professionals sign in somewhere else entirely, professionals also
 * join, and with no backend configured both portals are browsable on seed data.
 * Hung individually off the header those become five competing links next to
 * the primary call to action, which is how a navbar stops being scannable.
 *
 * So they live here, grouped and labelled, and the header keeps one control.
 * The groups are the point: a professional looking for their portal should not
 * have to work out which of two "sign in" links is theirs.
 */
export function AccountMenu({
  signedInAsClient,
  demoMode,
}: {
  /** Somebody is actually signed in as a customer — not the seeded stand-in. */
  signedInAsClient: boolean;
  /** No backend configured, so both portals render seed data without signing in. */
  demoMode: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={signedInAsClient ? "Your account" : "Sign in or join"}
        className={cn(
          "flex h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[14.5px] transition-colors hover:bg-surface-2 hover:text-ink sm:text-[13.5px]",
          open ? "bg-surface-2 text-ink" : "text-ink-2",
        )}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 fill-ink-4" aria-hidden="true">
          <path d="M10 10a3 3 0 100-6 3 3 0 000 6zm0 2c-3 0-6 1.5-6 4v1h12v-1c0-2.5-3-4-6-4z" />
        </svg>
        <span className="hidden lg:inline">{signedInAsClient ? "Account" : "Sign in"}</span>
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
          ) : (
            <Group>
              <Item
                href="/login"
                label="Sign in"
                hint="Track your quotes and projects"
                emphasis
              />
              <Item href="/submit-requirement" label="Create an account" hint="Post a requirement — we make one for you" />
            </Group>
          )}

          <Group heading="For professionals" divided>
            <Item
              href="/join-as-professional"
              label="Join as a professional"
              hint="Qualified leads in your trade"
            />
            <Item href="/login" label="Professional sign in" />
          </Group>

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
