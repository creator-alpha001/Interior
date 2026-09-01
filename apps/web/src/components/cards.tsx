import Link from "next/link";
import type { BlogPostView, PackageView, ProductView, ProfessionalSummary } from "@repo/types";
import { formatRupees, formatRupeesShort, priceUnitLabel } from "@repo/data";
import { Badge, Media, RatingLine, VerifiedBadge, cn } from "@repo/ui";

export function ProductCard({ view, className }: { view: ProductView; className?: string }) {
  const { product, domain, effectivePrice } = view;
  return (
    <Link
      href={`/product/${product.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Media src={product.media[0]?.url ?? "ph:default:x"} alt={product.name} rounded={false} />
        {product.tags.includes("bestseller") ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] sm:text-[11px] font-semibold text-clay shadow-sm">
            Bestseller
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[12px] sm:text-[11px] font-medium uppercase tracking-[0.1em] text-ink-4">
          {domain.name}
        </p>
        <h3 className="mt-1.5 font-sans text-[15px] font-semibold leading-snug text-ink transition-colors group-hover:text-brand">
          {product.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[14px] sm:text-[13px] leading-relaxed text-ink-3">
          {product.shortDescription}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <div>
            <div className="text-[12.5px] sm:text-[11.5px] text-ink-4">Starting at</div>
            <div className="font-display text-[21px] leading-none text-ink">
              {formatRupees(effectivePrice)}
              <span className="ml-1 font-sans text-[12.5px] sm:text-[11.5px] text-ink-4">
                {priceUnitLabel[product.priceUnit]}
              </span>
            </div>
          </div>
          <RatingLine value={product.rating} count={product.ratingCount} className="shrink-0" />
        </div>
      </div>
    </Link>
  );
}

export function PackageCard({ view, className }: { view: PackageView; className?: string }) {
  const { servicePackage: pkg, domain, items } = view;
  return (
    <Link
      href={`/packages/${pkg.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <Media src={pkg.media[0]?.url ?? "ph:default:x"} alt={pkg.name} rounded={false} />
        {pkg.badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-clay px-2.5 py-1 text-[12px] sm:text-[11px] font-semibold text-white">
            {pkg.badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[12px] sm:text-[11px] font-medium uppercase tracking-[0.1em] text-ink-4">
          {domain.name}
        </p>
        <h3 className="mt-1.5 font-display text-[20px] leading-tight text-ink transition-colors group-hover:text-brand">
          {pkg.name}
        </h3>
        <p className="mt-2 line-clamp-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
          {pkg.shortDescription}
        </p>

        <ul className="mt-4 space-y-1.5">
          {items.slice(0, 3).map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[14px] sm:text-[13px] text-ink-2">
              <svg
                viewBox="0 0 16 16"
                className="mt-[3px] h-3.5 w-3.5 shrink-0 fill-brand"
                aria-hidden="true"
              >
                <path d="M6.5 11.4L3.3 8.2l1-1 2.2 2.2 5-5 1 1-6 6z" />
              </svg>
              <span className="line-clamp-1">
                {item.quantity > 1 ? `${item.quantity} × ` : ""}
                {item.label}
              </span>
            </li>
          ))}
          {items.length > 3 ? (
            <li className="pl-5.5 text-[13.5px] sm:text-[12.5px] text-ink-4">+{items.length - 3} more included</li>
          ) : null}
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <div className="font-display text-[22px] leading-none text-ink">
              {formatRupeesShort(pkg.price)}
            </div>
            <div className="mt-1 text-[12.5px] sm:text-[11.5px] text-ink-4">{pkg.priceBasis}</div>
          </div>
          <Badge tone="neutral">{pkg.durationDays} days</Badge>
        </div>
      </div>
    </Link>
  );
}

export function ProfessionalCard({
  pro,
  className,
  contextDomain,
}: {
  pro: ProfessionalSummary;
  className?: string;
  contextDomain?: string;
}) {
  const rating = pro.domainRating?.avgRating ?? pro.avgRating;
  const count = pro.domainRating?.ratingCount ?? pro.ratingCount;

  return (
    <Link
      href={`/professionals/${pro.id}`}
      className={cn(
        "group flex flex-col rounded-xl border border-line bg-surface p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-[19px] text-brand">
          {pro.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-sans text-[15px] font-semibold text-ink transition-colors group-hover:text-brand">
            {pro.name}
          </h3>
          <p className="truncate text-[14px] sm:text-[13px] text-ink-3">{pro.companyName}</p>
        </div>
        {pro.isVerified ? <VerifiedBadge /> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {pro.domains.map((d) => (
          <Badge key={d.id} tone={d.name === contextDomain ? "brand" : "neutral"}>
            {d.name}
          </Badge>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
        <div>
          <dt className="text-[12px] sm:text-[11px] text-ink-4">Rating</dt>
          <dd className="mt-0.5 text-[15px] sm:text-[14px] font-semibold text-ink">{rating.toFixed(1)}</dd>
        </div>
        <div className="border-x border-line">
          <dt className="text-[12px] sm:text-[11px] text-ink-4">Experience</dt>
          <dd className="mt-0.5 text-[15px] sm:text-[14px] font-semibold text-ink">{pro.experienceYears} yrs</dd>
        </div>
        <div>
          <dt className="text-[12px] sm:text-[11px] text-ink-4">Projects</dt>
          <dd className="mt-0.5 text-[15px] sm:text-[14px] font-semibold text-ink">{pro.completedProjects}</dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between text-[13.5px] sm:text-[12.5px] text-ink-3">
        <RatingLine value={rating} count={count} />
        <span>Replies in ~{pro.avgResponseHours}h</span>
      </div>
    </Link>
  );
}

export function PostCard({
  view,
  className,
  featured = false,
}: {
  view: BlogPostView;
  className?: string;
  featured?: boolean;
}) {
  const { post, category } = view;
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className={cn("relative overflow-hidden", featured ? "aspect-[16/9]" : "aspect-[16/10]")}>
        <Media src={post.coverImageUrl} alt={post.title} rounded={false} />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-[12.5px] sm:text-[11.5px] text-ink-4">
          <span className="font-medium text-clay">{category.name}</span>
          <span>·</span>
          <span>{post.readingMinutes} min read</span>
        </div>
        <h3
          className={cn(
            "mt-2 font-display leading-tight text-ink transition-colors group-hover:text-brand",
            featured ? "text-[26px]" : "text-[19px]",
          )}
        >
          {post.title}
        </h3>
        <p className="mt-2.5 line-clamp-3 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
          {post.excerpt}
        </p>
        <div className="mt-auto pt-4 text-[13.5px] sm:text-[12.5px] text-ink-4">
          {post.authorName} · {post.authorRole}
        </div>
      </div>
    </Link>
  );
}
