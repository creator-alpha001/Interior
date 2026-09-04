"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@repo/ui";

/**
 * Bottom navigation, not a sidebar: vendors work this on a phone, standing on a
 * site, one-handed. The five destinations are the five things they actually do
 * — see new work, quote it, track what they won, and check what they are owed.
 */
const tabs = [
  { href: "/partner", label: "Home", exact: true, icon: "M10 2L2 8v10h5v-6h6v6h5V8l-8-6z" },
  { href: "/partner/leads", label: "Leads", icon: "M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h9v2H3v-2z" },
  { href: "/partner/projects", label: "Work", icon: "M4 5h12v10H4V5zm2 2v6h8V7H6z" },
  { href: "/partner/payments", label: "Payments", icon: "M2 5h16v10H2V5zm2 2v6h12V7H4zm2 2h4v2H6V9z" },
  { href: "/partner/profile", label: "Profile", icon: "M10 10a3 3 0 100-6 3 3 0 000 6zm0 2c-3 0-6 1.5-6 4v1h12v-1c0-2.5-3-4-6-4z" },
];

export function VendorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <Link href="/partner" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-white">
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                <path d="M10 2L2 8v10h5v-6h6v6h5V8l-8-6z" />
              </svg>
            </span>
            <div>
              <div className="text-[14px] font-semibold leading-none">Aangan</div>
              <div className="mt-0.5 text-[10.5px] uppercase tracking-wider text-ink-4">
                For professionals
              </div>
            </div>
          </Link>

          {/* Wider screens get the tabs inline; phones use the bottom bar. */}
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {tabs.map((tab) => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[13.5px] transition-colors",
                    active
                      ? "bg-brand-soft font-medium text-brand"
                      : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 pb-20 sm:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface sm:hidden">
        <div className="flex">
          {tabs.map((tab) => {
            const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10.5px] transition-colors",
                  active ? "text-brand" : "text-ink-4",
                )}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
