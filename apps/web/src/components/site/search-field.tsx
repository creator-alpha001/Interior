"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The search page needs its own input: on a phone the header dropdown is not
 * where someone lands when they tap the search icon, and a results page with
 * no way to change the query is a dead end.
 */
export function SearchField({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
      className="mt-5 flex gap-2"
      role="search"
    >
      <div className="flex h-12 flex-1 items-center gap-2.5 rounded-full border border-line bg-surface px-4 focus-within:border-brand">
        <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-ink-4" aria-hidden="true">
          <path d="M7 1a6 6 0 104.2 10.3l3.3 3.2 1-1-3.2-3.3A6 6 0 007 1zm0 1.5A4.5 4.5 0 112.5 7 4.5 4.5 0 017 2.5z" />
        </svg>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Wardrobes, painting, gates…"
          aria-label="Search"
          autoComplete="off"
          className="w-full bg-transparent text-ink outline-none placeholder:text-ink-4"
        />
        {value ? (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-4 hover:bg-surface-2"
          >
            ×
          </button>
        ) : null}
      </div>
      <button
        type="submit"
        className="h-12 shrink-0 rounded-full bg-brand px-5 text-[15px] font-medium text-white transition-colors hover:bg-brand-hover"
      >
        Search
      </button>
    </form>
  );
}
