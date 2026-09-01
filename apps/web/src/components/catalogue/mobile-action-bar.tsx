import Link from "next/link";
import { formatRupees } from "@repo/data";

/**
 * Phones only. A product page is ~4,500px tall on a 375px screen, which puts
 * the real call to action four or five thumb-flicks below the fold. This keeps
 * the price and the action in view the whole way down, and disappears at `sm:`
 * where the sidebar already does the job.
 */
export function MobileActionBar({
  price,
  priceLabel,
  href,
  cta,
  note,
}: {
  price: number;
  priceLabel: string;
  href: string;
  cta: string;
  note?: string;
}) {
  return (
    <>
      {/* Reserve the space so the bar never covers the last of the content. */}
      <div className="h-20 lg:hidden" aria-hidden="true" />

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <div className="font-display text-[21px] leading-none text-ink">
              {formatRupees(price)}
            </div>
            <div className="mt-1 truncate text-[12px] text-ink-4">{priceLabel}</div>
          </div>
          <Link
            href={href}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-brand px-6 text-[15px] font-medium text-white transition-colors hover:bg-brand-hover"
          >
            {cta}
          </Link>
        </div>
        {note ? (
          <p className="border-t border-line px-4 py-1.5 text-center text-[12px] text-ink-4">
            {note}
          </p>
        ) : null}
      </div>
    </>
  );
}
