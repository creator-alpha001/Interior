"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@repo/ui";
import { staffSignOutAction } from "@/app/login/actions";

/**
 * A persistent sidebar rather than a top nav: staff move between the queue, a
 * lead and the relay dozens of times an hour, and a fixed left rail keeps those
 * one click apart at any scroll position.
 */

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const groups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Dashboard", exact: true },
      { href: "/my-day", label: "My day" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/leads", label: "Lead queue" },
      { href: "/visits", label: "Site visits" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/vendors", label: "Vendors" },
      { href: "/applications", label: "Applications" },
      { href: "/agreements", label: "Agreements" },
      { href: "/commission", label: "Commission" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    title: "Configuration",
    items: [
      { href: "/domains", label: "Domains" },
      { href: "/catalogue", label: "Catalogue" },
      { href: "/blog", label: "Blog" },
      { href: "/support", label: "Support" },
    ],
  },
];

export function OpsShell({
  children,
  staff,
}: {
  children: ReactNode;
  /**
   * Who is actually signed in.
   *
   * This used to be the string "Kavita Bisht · Sales · Lucknow", hardcoded — a
   * seeded person printed in the corner of every screen regardless of who was
   * looking at it. Harmless while the panel had no sign-in and actively
   * misleading now that it does: an audit conversation starts with "who was
   * logged in", and the sidebar was answering with a fixture.
   */
  staff: { name: string; role: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 shrink-0 border-r border-line bg-surface transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-white">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="M10 2L2 8v10h5v-6h6v6h5V8l-8-6z" />
            </svg>
          </span>
          <div>
            <div className="text-[14px] font-semibold leading-none">InterioBee</div>
            <div className="mt-0.5 text-[10.5px] uppercase tracking-wider text-ink-4">
              Operations
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-5 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-ink-4">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.exact
                    ? pathname === item.href
                    : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors",
                        active
                          ? "bg-brand-soft font-medium text-brand"
                          : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-clay-soft text-[12px] font-semibold text-clay">
              {staff.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{staff.name}</div>
              <div className="text-[11px] text-ink-4">
                {staff.role === "admin" ? "Administrator" : "Sales agent"}
              </div>
            </div>
          </div>
          <form action={staffSignOutAction}>
            <button
              type="submit"
              className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
        />
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-surface-2"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M3 5h14v1.5H3V5zm0 4.25h14v1.5H3v-1.5zM3 13.5h14V15H3v-1.5z" />
            </svg>
          </button>
          <span className="text-[14px] font-semibold">InterioBee Operations</span>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
