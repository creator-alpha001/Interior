"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@repo/ui";

interface Suggestion {
  label: string;
  hint: string;
  href: string;
}

/**
 * Header search. Suggestions come from a route handler rather than being
 * bundled, so the catalogue can grow without shipping it to every visitor.
 */
export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Too short to search: derive an empty list rather than clearing state from
  // inside the effect, which would cause an extra render on every keystroke.
  const isSearchable = query.trim().length >= 2;
  const visible = isSearchable ? suggestions : [];

  useEffect(() => {
    if (!isSearchable) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (res.ok) setSuggestions(await res.json());
      } catch {
        // Aborted or offline — leaving the previous suggestions is fine.
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isSearchable]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(href?: string) {
    setOpen(false);
    if (href) router.push(href);
    else if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 transition-colors focus-within:border-brand">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-ink-4" aria-hidden="true">
          <path d="M7 1a6 6 0 104.2 10.3l3.3 3.2 1-1-3.2-3.3A6 6 0 007 1zm0 1.5A4.5 4.5 0 112.5 7 4.5 4.5 0 017 2.5z" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              go(active >= 0 ? visible[active]?.href : undefined);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, visible.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search wardrobes, painting, gates…"
          aria-label="Search"
          className="w-full bg-transparent text-[14.5px] sm:text-[13.5px] text-ink outline-none placeholder:text-ink-4"
        />
      </div>

      {open && visible.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]">
          {visible.map((s, i) => (
            <button
              key={s.href}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => go(s.href)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                active === i ? "bg-surface-2" : "hover:bg-surface-2",
              )}
            >
              <span className="truncate text-[14.5px] sm:text-[13.5px] text-ink">{s.label}</span>
              <span className="shrink-0 text-[12.5px] sm:text-[11.5px] text-ink-4">{s.hint}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => go()}
            className="mt-1 w-full rounded-lg border-t border-line px-3 py-2 text-left text-[13.5px] sm:text-[12.5px] font-medium text-brand"
          >
            See all results for “{query.trim()}” →
          </button>
        </div>
      ) : null}
    </div>
  );
}
