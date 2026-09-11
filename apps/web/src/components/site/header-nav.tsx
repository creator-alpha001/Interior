"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { City } from "@repo/types";
import { AccountMenu } from "@/components/site/account-menu";
import { CitySwitcher } from "@/components/site/city-switcher";
import { SearchBox } from "@/components/site/search-box";
import { ButtonLink, Media, cn } from "@repo/ui";

const domains = [
  { name: "Interior Design", slug: "interior-design", hint: "Full & partial home interiors" },
  { name: "Furniture Work", slug: "furniture", hint: "Made to your measurements" },
  { name: "Fabrication", slug: "fabrication", hint: "Gates, grills, railings, sheds" },
  { name: "Painting", slug: "painting", hint: "Interior, exterior, waterproofing" },
];

const links = [
  { name: "Packages", href: "/packages" },
  { name: "Our work", href: "/our-work" },
  { name: "Estimate", href: "/estimate" },
  { name: "Professionals", href: "/professionals" },
  { name: "Blog", href: "/blog" },
];

/**
 * The site header, in two tiers.
 *
 * It used to be one 64px row carrying six navigation items, search, the city,
 * the account and the primary button. Below a very wide screen that row ran
 * out of room, and the browser's answer was to wrap "Our work" and "All cities"
 * onto two lines and clip the search box. Nothing was prioritised; everything
 * just got squeezed.
 *
 * So the things a visitor sets once — city, account, the way in for
 * professionals — sit in a slim utility bar that scrolls away, and the sticky
 * bar keeps only what is used while browsing: the logo, the navigation, search
 * and "Get free quotes". Every label is `whitespace-nowrap`, and the navigation
 * folds into the menu before it can wrap rather than after.
 */
export function HeaderNav({
  cities,
  selectedCity,
  signedInAsClient,
  accountName,
  completingSignIn,
  demoMode,
}: {
  cities: City[];
  /** Null when nobody has chosen one — a real state, not a missing value. */
  selectedCity: City | null;
  signedInAsClient: boolean;
  /** Shown in place of "Account" once there is a real session. */
  accountName?: string | null;
  /** A Google sign-in is mid-flight: no session yet, but do not invite another. */
  completingSignIn?: boolean;
  demoMode: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  // Navigating should close both menus. Adjusting state during render when a
  // value changes is React's own recommended pattern for this — an effect
  // would render the new page with the menu still open, then close it, which
  // is the cascading render the linter is warning about.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (pathname !== renderedPath) {
    setRenderedPath(pathname);
    setOpen(false);
    setServicesOpen(false);
  }

  const navItem =
    "flex h-10 items-center whitespace-nowrap rounded-full px-3 text-[14.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink";

  return (
    <>
      {/* ---------------- Utility bar ---------------- */}
      <div className="hidden bg-brand text-white sm:block">
        <div className="mx-auto flex h-10 w-full max-w-7xl items-center gap-4 px-5 sm:px-8">
          <p className="hidden min-w-0 items-center gap-2 truncate text-[13px] text-white/75 md:flex">
            <span className="font-medium text-white">Homes that feel like you</span>
            <span className="text-white/35" aria-hidden="true">
              ·
            </span>
            <span className="truncate">Verified professionals, three quotes, no sales calls</span>
          </p>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <CitySwitcher cities={cities} selected={selectedCity} tone="dark" />
            <Link
              href="/join-as-professional"
              className="hidden h-9 items-center whitespace-nowrap rounded-full px-3 text-[13px] text-white/85 transition-colors hover:bg-white/10 hover:text-white lg:flex"
            >
              For professionals
            </Link>
            <span className="mx-1 h-4 w-px bg-white/25" aria-hidden="true" />
            <AccountMenu
              tone="dark"
              signedInAsClient={signedInAsClient}
              accountName={accountName}
              completingSignIn={completingSignIn}
              demoMode={demoMode}
            />
          </div>
        </div>
      </div>

      {/* ---------------- Main bar ---------------- */}
      <header className="sticky top-0 z-50 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] w-full max-w-7xl items-center gap-3 px-5 sm:px-8 xl:gap-5">
          {/* The brand's own mark and wordmark, cut from the logo artwork into
              `public/brand`. Side by side rather than the stacked original,
              which at header height would shrink the name past reading. */}
          <Link href="/" aria-label="Decora Shine home" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/decora-shine-mark.png"
              alt=""
              width={231}
              height={256}
              className="h-10 w-auto"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/decora-shine-wordmark.png"
              alt="Decora Shine"
              width={667}
              height={96}
              className="h-[19px] w-auto sm:h-[23px]"
            />
          </Link>

          <nav className="ml-2 hidden items-center gap-0.5 xl:flex" aria-label="Main">
            <div
              className="relative"
              onMouseEnter={() => setServicesOpen(true)}
              onMouseLeave={() => setServicesOpen(false)}
            >
              <button
                className={cn(navItem, "gap-1.5", pathname.startsWith("/catalogue") && "text-ink")}
                onClick={() => setServicesOpen((v) => !v)}
                aria-expanded={servicesOpen}
              >
                Services
                <svg
                  viewBox="0 0 12 12"
                  className={cn("h-2.5 w-2.5 fill-current transition-transform", servicesOpen && "rotate-180")}
                  aria-hidden="true"
                >
                  <path d="M6 8.5L1.5 4h9L6 8.5z" />
                </svg>
              </button>
              {servicesOpen ? (
                <div className="absolute left-0 top-full w-[380px] pt-2">
                  <div className="overflow-hidden rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-lift)]">
                    {domains.map((d) => (
                      <Link
                        key={d.slug}
                        href={`/catalogue/${d.slug}`}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface-2"
                      >
                        <span className="h-12 w-14 shrink-0 overflow-hidden rounded-md">
                          <Media src={`ph:${d.slug}:nav`} alt="" rounded={false} />
                        </span>
                        <span>
                          <span className="block text-[14.5px] font-medium text-ink">{d.name}</span>
                          <span className="block text-[13px] text-ink-3">{d.hint}</span>
                        </span>
                      </Link>
                    ))}
                    <Link
                      href="/catalogue"
                      className="mt-1 block rounded-lg border-t border-line px-3 py-2.5 text-[13.5px] font-medium text-brand"
                    >
                      Browse the full catalogue →
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>

            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={cn(navItem, pathname.startsWith(l.href) && "bg-surface-2 font-medium text-ink")}
              >
                {l.name}
              </Link>
            ))}
          </nav>

          <SearchBox className="ml-auto hidden w-56 lg:block 2xl:w-72" />

          <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:ml-0">
            <ButtonLink
              href="/submit-requirement"
              size="sm"
              className="shrink-0 whitespace-nowrap px-3.5 sm:px-5"
            >
              <span className="sm:hidden">Get quotes</span>
              <span className="hidden sm:inline">Get free quotes</span>
            </ButtonLink>

            <Link
              href="/search"
              aria-label="Search"
              className="grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M7 1a6 6 0 104.2 10.3l3.3 3.2 1-1-3.2-3.3A6 6 0 007 1zm0 1.5A4.5 4.5 0 112.5 7 4.5 4.5 0 017 2.5z" />
              </svg>
            </Link>

            <button
              className="grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-surface-2 xl:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={open}
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
                {open ? (
                  <path d="M5.3 4.3l10.4 10.4-1 1L4.3 5.3l1-1zm10.4 1l-10.4 10.4-1-1L14.7 4.3l1 1z" />
                ) : (
                  <path d="M3 5h14v1.5H3V5zm0 4.25h14v1.5H3v-1.5zM3 13.5h14V15H3v-1.5z" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open ? (
          <div className="max-h-[calc(100vh-68px)] overflow-y-auto border-t border-line bg-surface xl:hidden">
            <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                Services
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {domains.map((d) => (
                  <Link
                    key={d.slug}
                    href={`/catalogue/${d.slug}`}
                    className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-surface-2"
                  >
                    <span className="h-11 w-12 shrink-0 overflow-hidden rounded-md">
                      <Media src={`ph:${d.slug}:nav`} alt="" rounded={false} />
                    </span>
                    <span className="text-[15px] text-ink">{d.name}</span>
                  </Link>
                ))}
              </div>
              <div className="my-3 h-px bg-line" />
              <div className="grid gap-1 sm:grid-cols-2">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} className="rounded-lg px-2 py-2 text-[15px] hover:bg-surface-2">
                    {l.name}
                  </Link>
                ))}
              </div>

              {/* Its own section rather than another entry in the list above:
                  signing in is not the same kind of thing as browsing packages,
                  and on a phone the list is long enough that it would be lost.
                  On wider screens the utility bar already carries it. */}
              <div className="sm:hidden">
                <div className="my-3 h-px bg-line" />
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  Account
                </p>
                <div className="grid gap-1">
                  {(signedInAsClient
                    ? [{ name: "My requirements", href: "/account" }]
                    : completingSignIn
                      ? // No account yet, so "My requirements" would lead nowhere.
                        [{ name: "Finish setting up", href: "/welcome" }]
                      : // Both, and in that order — the same pair the desktop bar
                        // shows. Offering only "Sign in" on a phone left somebody
                        // with no account nothing to press.
                        [
                          { name: "Sign in", href: "/login" },
                          { name: "Sign up", href: "/login?mode=signup" },
                        ]
                  ).map((l) => (
                    <Link key={l.href} href={l.href} className="rounded-lg px-2 py-2 text-[15px] hover:bg-surface-2">
                      {l.name}
                    </Link>
                  ))}
                  <Link
                    href="/join-as-professional"
                    className="rounded-lg px-2 py-2 text-[15px] hover:bg-surface-2"
                  >
                    Join as a professional
                  </Link>
                  {demoMode ? (
                    <Link
                      href="/partner"
                      className="rounded-lg px-2 py-2 text-[15px] text-ink-3 hover:bg-surface-2"
                    >
                      Professional portal <span className="text-ink-4">— preview</span>
                    </Link>
                  ) : null}
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                    Your city
                  </p>
                  <CitySwitcher cities={cities} selected={selectedCity} />
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
                    Prices and available professionals vary by city.
                  </p>
                </div>
              </div>

              <div className="mt-4 lg:hidden">
                <SearchBox />
              </div>
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
}
