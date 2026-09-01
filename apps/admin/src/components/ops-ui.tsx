import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@repo/ui";

/** Chrome specific to the ops panel — denser than the customer-facing set. */

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="border-b border-line bg-surface px-5 py-4 sm:px-7">
      {breadcrumb ? (
        <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-4">
          {breadcrumb.map((item, i) => (
            <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden="true">/</span> : null}
              {item.href ? (
                <Link href={item.href} className="hover:text-ink-2">
                  {item.label}
                </Link>
              ) : (
                <span className="text-ink-2">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] leading-tight sm:text-[23px]">{title}</h1>
          {subtitle ? <p className="mt-1 text-[13px] text-ink-3">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-5 sm:px-7 sm:py-6", className)}>{children}</div>;
}

export function Panel({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-lg border border-line bg-surface", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">{title}</h2>
          {action}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "urgent" | "positive";
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[11.5px] uppercase tracking-wider text-ink-4">{label}</p>
      <p
        className={cn(
          "tnum mt-1.5 font-display text-[28px] leading-none",
          tone === "urgent" ? "text-danger" : tone === "positive" ? "text-positive" : "text-ink",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[12px] text-ink-3">{hint}</p> : null}
    </>
  );

  const className = cn(
    "block rounded-lg border border-line bg-surface p-4",
    href && "transition-colors hover:border-ink-4",
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** A dense data table. Columns are declared so headers and cells cannot drift. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowHref,
}: {
  columns: Array<{
    key: string;
    header: string;
    align?: "left" | "right";
    width?: string;
    render: (row: T) => ReactNode;
  }>;
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowHref?: (row: T) => string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-[13px] text-ink-3">
        {empty ?? "Nothing here."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead className="bg-surface-2 text-[11px] uppercase tracking-wider text-ink-3">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  "px-3 py-2.5 font-semibold",
                  col.align === "right" ? "text-right" : "text-left",
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = onRowHref?.(row);
            return (
              <tr
                key={rowKey(row)}
                className={cn(
                  "border-t border-line align-top",
                  href && "cursor-pointer transition-colors hover:bg-surface-2",
                )}
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn("px-3 py-3", col.align === "right" && "text-right")}
                  >
                    {href && i === 0 ? (
                      <Link href={href} className="block">
                        {col.render(row)}
                      </Link>
                    ) : (
                      col.render(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3">
      {children}
    </div>
  );
}

export function FilterGroup({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: Array<{ value: string; label: string; count?: number }>;
  current: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-[11px] uppercase tracking-wider text-ink-4">{label}</span>
      {options.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value)}
          className={cn(
            "rounded-md px-2 py-1 text-[12.5px] transition-colors",
            current === option.value
              ? "bg-brand text-white"
              : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          {option.label}
          {option.count !== undefined ? (
            <span className={cn("ml-1", current === option.value ? "text-white/70" : "text-ink-4")}>
              {option.count}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
