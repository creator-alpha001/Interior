"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { City } from "@repo/types";
import { CitySwitcher } from "@/components/site/city-switcher";
import { SearchBox } from "@/components/site/search-box";
import { ButtonLink, cn } from "@repo/ui";

const domains = [
  { name: "Interior Design", href: "/catalogue/interior-design", hint: "Full & partial home interiors" },
  { name: "Furniture Work", href: "/catalogue/furniture", hint: "Made to your measurements" },
  { name: "Fabrication", href: "/catalogue/fabrication", hint: "Gates, grills, railings, sheds" },
  { name: "Painting", href: "/catalogue/painting", hint: "Interior, exterior, waterproofing" },
];

const links = [
  { name: "Packages", href: "/packages" },
  { name: "Our work", href: "/our-work" },
  { name: "Estimate", href: "/estimate" },
  { name: "Professionals", href: "/professionals" },
  { name: "Blog", href: "/blog" },
];

export function HeaderNav({ cities, selectedCity }: { cities: City[]; selectedCity: City }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    setServicesOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M10 2L2 8v10h5v-6h6v6h5V8l-8-6z" />
            </svg>
          </span>
          <span className="font-display text-[21px] leading-none tracking-tight">Aangan</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] sm:text-[14px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
                pathname.startsWith("/catalogue") && "text-ink",
              )}
              onClick={() => setServicesOpen((v) => !v)}
              aria-expanded={servicesOpen}
            >
              Services
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
                <path d="M6 8.5L1.5 4h9L6 8.5z" />
              </svg>
            </button>
            {servicesOpen ? (
              <div className="absolute left-0 top-full w-[340px] pt-2">
                <div className="overflow-hidden rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-lift)]">
                  {domains.map((d) => (
                    <Link
                      key={d.href}
                      href={d.href}
                      className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <div className="text-[15px] sm:text-[14px] font-medium text-ink">{d.name}</div>
                      <div className="text-[13.5px] sm:text-[12.5px] text-ink-3">{d.hint}</div>
                    </Link>
                  ))}
                  <Link
                    href="/catalogue"
                    className="mt-1 block rounded-lg border-t border-line px-3 py-2.5 text-[14px] sm:text-[13px] font-medium text-brand"
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
              className={cn(
                "flex h-9 items-center rounded-full px-3.5 text-[15px] sm:text-[14px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
                pathname.startsWith(l.href) && "text-ink",
              )}
            >
              {l.name}
            </Link>
          ))}
        </nav>

        <SearchBox className="ml-auto hidden w-56 xl:block" />

        <div className="ml-auto flex items-center gap-1.5 xl:ml-3">
          <span className="hidden sm:block">
            <CitySwitcher cities={cities} selected={selectedCity} />
          </span>
          <Link
            href="/account"
            className="hidden h-9 items-center rounded-full px-3.5 text-[15px] sm:text-[14px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:flex"
          >
            My requirements
          </Link>
          <ButtonLink
            href="/submit-requirement"
            size="sm"
            className="shrink-0 whitespace-nowrap px-3.5 sm:px-4"
          >
            <span className="sm:hidden">Get quotes</span>
            <span className="hidden sm:inline">Get free quotes</span>
          </ButtonLink>

          <Link
            href="/search"
            aria-label="Search"
            className="grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-surface-2 xl:hidden"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M7 1a6 6 0 104.2 10.3l3.3 3.2 1-1-3.2-3.3A6 6 0 007 1zm0 1.5A4.5 4.5 0 112.5 7 4.5 4.5 0 017 2.5z" />
            </svg>
          </Link>

          <button
            className="grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden"
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
        <div className="border-t border-line bg-surface lg:hidden">
          <div className="mx-auto max-w-7xl px-5 py-4 sm:px-8">
            <p className="mb-2 text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
              Services
            </p>
            <div className="grid gap-1">
              {domains.map((d) => (
                <Link key={d.href} href={d.href} className="rounded-lg px-2 py-2 text-[15px] hover:bg-surface-2">
                  {d.name}
                </Link>
              ))}
            </div>
            <div className="my-3 h-px bg-line" />
            <div className="grid gap-1">
              {[...links, { name: "My requirements", href: "/account" }].map((l) => (
                <Link key={l.href} href={l.href} className="rounded-lg px-2 py-2 text-[15px] hover:bg-surface-2">
                  {l.name}
                </Link>
              ))}
            </div>
            <div className="mt-4 sm:hidden">
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                Your city
              </p>
              <CitySwitcher cities={cities} selected={selectedCity} />
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-4">
                Prices and available professionals vary by city.
              </p>
            </div>

            <div className="mt-4">
              <SearchBox />
            </div>
            <ButtonLink href="/submit-requirement" className="mt-4 w-full">
              Get free quotes
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </header>
  );
}
