import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

/* ---------------- Layout ---------------- */

export function Container({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  width?: "default" | "wide" | "narrow";
}) {
  const widths = {
    narrow: "max-w-3xl",
    default: "max-w-6xl",
    wide: "max-w-7xl",
  };
  return (
    <div className={cn("mx-auto w-full px-5 sm:px-8", widths[width], className)}>{children}</div>
  );
}

export function Section({
  children,
  className,
  tone = "paper",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "paper" | "surface" | "sand" | "brand";
  id?: string;
}) {
  const tones = {
    paper: "bg-paper",
    surface: "bg-surface",
    sand: "bg-surface-2",
    brand: "bg-brand text-white",
  };
  return (
    <section id={id} className={cn("py-14 sm:py-20", tones[tone], className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  invert = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  align?: "left" | "center";
  invert?: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:mb-10",
        align === "center"
          ? "items-center text-center"
          : "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className={cn(align === "center" && "max-w-2xl")}>
        {eyebrow ? (
          <p
            className={cn(
              "mb-2 text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em]",
              invert ? "text-white/60" : "text-clay",
            )}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2 className={cn("text-[26px] sm:text-[34px]", invert && "text-white")}>{title}</h2>
        {description ? (
          <p
            className={cn(
              "mt-3 max-w-2xl text-[15px] leading-relaxed",
              invert ? "text-white/70" : "text-ink-3",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------------- Buttons ---------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "clay" | "onDark";
type ButtonSize = "sm" | "md" | "lg";

const buttonBase =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink-4 hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  clay: "bg-clay text-white hover:brightness-95",
  onDark: "bg-white text-brand hover:bg-white/90",
};

/**
 * Mobile first: every button clears the 44px touch target on a phone and
 * tightens from `sm:` upward, where a pointer makes precision cheap.
 */
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-11 px-4 text-[14px] sm:h-9 sm:text-[13px]",
  md: "h-12 px-6 text-[15px] sm:h-11 sm:text-[14px]",
  lg: "h-[3.25rem] px-7 text-[16px] sm:h-12 sm:text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      className={cn(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...props}
    />
  );
}

/* ---------------- Surfaces ---------------- */

export function Card({
  children,
  className,
  hover = false,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface",
        padded && "p-5",
        hover && "transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ---------------- Badges & chips ---------------- */

type BadgeTone = "neutral" | "brand" | "clay" | "positive" | "warning" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-ink-2 border-line",
  brand: "bg-brand-soft text-brand border-brand-line",
  clay: "bg-clay-soft text-clay border-clay-line",
  positive: "bg-positive-soft text-positive border-positive/20",
  warning: "bg-warning-soft text-warning border-warning/20",
  danger: "bg-danger-soft text-danger border-danger/20",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12.5px] sm:text-[11.5px] font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <Badge tone="brand">
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <path d="M8 0.8l1.9 1.4 2.3-.2.7 2.2 1.9 1.3-1 2.1 1 2.1-1.9 1.3-.7 2.2-2.3-.2L8 15.2l-1.9-1.4-2.3.2-.7-2.2L1.2 10.5l1-2.1-1-2.1 1.9-1.3.7-2.2 2.3.2L8 .8zm3.1 5.1l-1-1-2.9 2.9-1.3-1.3-1 1 2.3 2.3 3.9-3.9z" />
      </svg>
      Verified
    </Badge>
  );
}

/* ---------------- Rating ---------------- */

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block h-3.5 w-3.5">
            <Star className="absolute inset-0 text-line-strong" />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className="text-clay" />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function Star({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("h-3.5 w-3.5 fill-current", className)}>
      <path d="M10 1.6l2.5 5.1 5.6.8-4 3.9 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.8L10 1.6z" />
    </svg>
  );
}

export function RatingLine({
  value,
  count,
  className,
}: {
  value: number;
  count?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[14px] sm:text-[13px]", className)}>
      <Stars value={value} />
      <span className="font-medium text-ink">{value.toFixed(1)}</span>
      {count !== undefined ? <span className="text-ink-4">({count})</span> : null}
    </span>
  );
}

/* ---------------- Misc ---------------- */

export function Stat({
  value,
  label,
  invert = false,
}: {
  value: string;
  label: string;
  invert?: boolean;
}) {
  return (
    <div>
      <div
        className={cn(
          "font-display text-[30px] leading-none sm:text-[38px]",
          invert ? "text-white" : "text-brand",
        )}
      >
        {value}
      </div>
      <div className={cn("mt-2 text-[14px] sm:text-[13px]", invert ? "text-white/60" : "text-ink-3")}>{label}</div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <h3 className="text-[19px]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[14px] text-ink-3">{description}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-[13.5px] sm:text-[12.5px] text-ink-4">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden="true">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-ink-2">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-2">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <dt className="text-[14px] sm:text-[13px] text-ink-3">{label}</dt>
      <dd className="text-right text-[13.5px] font-medium text-ink">{value}</dd>
    </div>
  );
}
