"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Searches name, mobile, reference and description together — coordinators
 * arrive at this box holding whichever one the customer just said on the phone.
 */
export function LeadSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(initial);

  const submit = (next: string) => {
    const qs = new URLSearchParams(params.toString());
    if (next.trim()) qs.set("q", next.trim());
    else qs.delete("q");
    const s = qs.toString();
    router.push(s ? `/leads?${s}` : "/leads");
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 focus-within:border-brand sm:w-72"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-ink-4" aria-hidden="true">
        <path d="M7 1a6 6 0 104.2 10.3l3.3 3.2 1-1-3.2-3.3A6 6 0 007 1zm0 1.5A4.5 4.5 0 112.5 7 4.5 4.5 0 017 2.5z" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Name, mobile or LD-number"
        aria-label="Search leads"
        className="w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-4"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            submit("");
          }}
          aria-label="Clear search"
          className="shrink-0 text-ink-4 hover:text-ink"
        >
          ×
        </button>
      ) : null}
    </form>
  );
}
