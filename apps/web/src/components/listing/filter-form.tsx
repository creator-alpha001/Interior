"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { cn } from "@repo/ui";

/**
 * A listing's filters, applied as they are chosen.
 *
 * Ordinary inputs in an ordinary GET form, so the URL is the state: a filtered
 * page can be shared, reloaded and gone back to, and the form still submits
 * without script. Script only makes it immediate. A choice re-queries straight
 * away; typed price bounds wait for Enter or Go, because re-querying on every
 * digit would fetch ₹1, ₹15 and ₹150 on the way to ₹1500.
 *
 * An input can name fields it replaces with `data-clears`. Picking a price band
 * clears the typed bounds and typing bounds clears the band — otherwise both
 * would be sent and one would silently win.
 */
export function FilterForm({
  children,
  keep = {},
  className,
}: {
  children: ReactNode;
  /** Parameters owned by something outside the sidebar, such as the sort. */
  keep?: Record<string, string | undefined>;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function clearFields(form: HTMLFormElement, names: string) {
    for (const name of names.split(",")) {
      form.querySelectorAll<HTMLInputElement>(`[name="${name}"]`).forEach((field) => {
        if (field.type === "radio" || field.type === "checkbox") field.checked = field.value === "";
        else field.value = "";
      });
    }
  }

  function apply(form: HTMLFormElement) {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    });
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <form
      method="get"
      action={pathname}
      aria-busy={pending}
      onChange={(event) => {
        // React types a form's change event as the form's own; it is the field.
        const field = event.target as unknown as HTMLInputElement;
        if (field.type === "number") return;
        if (field.dataset.clears) clearFields(event.currentTarget, field.dataset.clears);
        apply(event.currentTarget);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        form.querySelectorAll<HTMLInputElement>('input[type="number"][data-clears]').forEach((field) => {
          if (field.value.trim()) clearFields(form, field.dataset.clears!);
        });
        apply(form);
      }}
      className={cn("transition-opacity", pending && "opacity-60", className)}
    >
      {Object.entries(keep).map(([name, value]) =>
        value ? <input key={name} type="hidden" name={name} value={value} /> : null,
      )}
      {children}
    </form>
  );
}

/** The sort order, which lives beside the results rather than in the sidebar. */
export function SortSelect({
  options,
  value,
  params,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  /** Every other parameter on the page, carried across the change. */
  params: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-[14px] text-ink-3 sm:text-[13px]">
      <span className="whitespace-nowrap">Sort by</span>
      <select
        // Keyed on the value, so the control shows the server's answer after
        // navigation rather than whatever was last clicked.
        key={value}
        defaultValue={value}
        disabled={pending}
        onChange={(event) => {
          const next = new URLSearchParams();
          for (const [key, v] of Object.entries(params)) {
            if (v && key !== "sort") next.set(key, v);
          }
          next.set("sort", event.target.value);
          startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
        }}
        className="h-10 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none transition-colors focus:border-brand sm:text-[13px]"
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
