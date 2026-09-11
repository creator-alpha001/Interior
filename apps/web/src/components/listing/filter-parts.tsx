import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The pieces a marketplace listing is built from: a sidebar of filter groups,
 * the chips saying what is applied, and the two-column frame they sit in.
 *
 * Server components throughout. The one piece that needs script — applying a
 * choice as it is made — is `FilterForm`, which wraps these.
 */

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-line py-5 first:pt-0 last:border-b-0 last:pb-0">
      <h3 className="px-2 text-[14px] font-semibold text-ink sm:text-[13px]">{title}</h3>
      <div className="mt-2.5 space-y-0.5">{children}</div>
    </section>
  );
}

/** One option in a group. A radio, so a group holds one answer and "All" is a real choice. */
export function Choice({
  name,
  value,
  checked,
  label,
  hint,
  clears,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  hint?: string;
  /** Comma-separated field names this choice replaces. See `FilterForm`. */
  clears?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-[14.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:text-[13.5px]">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={checked}
        data-clears={clears}
        className="h-4 w-4 shrink-0 accent-brand"
      />
      <span className="flex-1">{label}</span>
      {hint ? <span className="text-[12.5px] text-ink-4 sm:text-[11.5px]">{hint}</span> : null}
    </label>
  );
}

/** Typed price bounds, applied on Enter or Go. */
export function PriceInputs({ min, max }: { min?: number; max?: number }) {
  const field =
    "h-10 w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-brand sm:text-[13px]";
  return (
    <div className="mt-2 flex items-center gap-2 px-2">
      <label className="sr-only" htmlFor="price-min">
        Minimum price
      </label>
      <input
        id="price-min"
        type="number"
        name="minPrice"
        min={0}
        inputMode="numeric"
        placeholder="Min ₹"
        defaultValue={min}
        data-clears="price"
        className={field}
      />
      <span className="text-ink-4" aria-hidden="true">
        –
      </span>
      <label className="sr-only" htmlFor="price-max">
        Maximum price
      </label>
      <input
        id="price-max"
        type="number"
        name="maxPrice"
        min={0}
        inputMode="numeric"
        placeholder="Max ₹"
        defaultValue={max}
        data-clears="price"
        className={field}
      />
      <button
        type="submit"
        className="h-10 shrink-0 rounded-lg border border-line-strong bg-surface px-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-surface-2 sm:text-[12.5px]"
      >
        Go
      </button>
    </div>
  );
}

/** What is applied, each removable on its own, and a way to start over. */
export function ActiveFilters({
  chips,
  clearHref,
}: {
  chips: Array<{ label: string; href: string }>;
  clearHref: string;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.label}
          href={chip.href}
          scroll={false}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-line bg-brand-soft px-3 py-1 text-[13.5px] text-brand transition-colors hover:border-brand sm:text-[12.5px]"
        >
          {chip.label}
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden="true">
            <path d="M3.2 2.2L6 5l2.8-2.8 1 1L7 6l2.8 2.8-1 1L6 7 3.2 9.8l-1-1L5 6 2.2 3.2l1-1z" />
          </svg>
          <span className="sr-only">Remove this filter</span>
        </Link>
      ))}
      <Link
        href={clearHref}
        scroll={false}
        className="px-1 text-[13.5px] font-medium text-ink-3 underline underline-offset-4 hover:text-ink sm:text-[12.5px]"
      >
        Clear all
      </Link>
    </div>
  );
}

/**
 * The sidebar-and-results frame.
 *
 * On a phone the sidebar folds into a Filters panel above the results, because
 * a 260px column beside a product grid leaves neither usable. The filters are
 * rendered in both places; only one is ever visible.
 */
export function ListingLayout({
  filters,
  activeCount,
  toolbar,
  children,
}: {
  filters: ReactNode;
  activeCount: number;
  toolbar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-xl border border-line bg-surface p-4">
          <p className="mb-4 px-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">
            Filters
          </p>
          {filters}
        </div>
      </aside>

      <div className="min-w-0">
        <details className="group mb-5 rounded-xl border border-line bg-surface lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[15px] font-medium text-ink">
            <span>
              Filters
              {activeCount > 0 ? (
                <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-[12px] text-white">
                  {activeCount}
                </span>
              ) : null}
            </span>
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3 fill-current text-ink-3 transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              <path d="M6 8.5L1.5 4h9L6 8.5z" />
            </svg>
          </summary>
          <div className="border-t border-line p-4">{filters}</div>
        </details>

        {toolbar}
        {children}
      </div>
    </div>
  );
}
