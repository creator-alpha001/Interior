"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui";

export function AccountNav({
  counts,
}: {
  counts: { requirements: number; agreements: number; notifications: number };
}) {
  const pathname = usePathname();

  const tabs = [
    { href: "/account", label: "Overview", exact: true },
    { href: "/account/requirements", label: "Requirements", count: counts.requirements },
    { href: "/account/agreements", label: "Agreements", count: counts.agreements },
    { href: "/account/projects", label: "Projects" },
    { href: "/account/notifications", label: "Notifications", count: counts.notifications },
    { href: "/account/referrals", label: "Refer & earn" },
    { href: "/account/support", label: "Support" },
  ];

  return (
    <nav className="no-scrollbar -mb-px mt-6 flex snap-x snap-mandatory gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex shrink-0 snap-start items-center gap-2 border-b-2 px-4 py-3.5 text-[15px] transition-colors sm:py-3 sm:text-[14px]",
              active
                ? "border-brand font-medium text-brand"
                : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {tab.label}
            {tab.count ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[12px] sm:text-[11px] font-semibold",
                  active ? "bg-brand-soft text-brand" : "bg-surface-2 text-ink-3",
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
