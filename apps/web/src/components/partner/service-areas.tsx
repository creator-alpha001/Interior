"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { City } from "@repo/types";
import { setServiceAreasAction } from "@/app/partner/actions";

/**
 * The districts a vendor covers, grouped by state.
 *
 * This list is how leads reach them: a requirement in a district nobody covers
 * reaches nobody. It was set once when the application was approved and then
 * frozen, so taking on a new district meant asking ops — who had no screen for
 * it either. Now it is a set of tick boxes on their own profile.
 *
 * Saving replaces the list wholesale, which is what ticking boxes means. The
 * copy says so plainly, because "unticked" quietly meaning "stop sending me
 * work here" is worth stating rather than implying.
 */
export function ServiceAreas({ all, mine }: { all: City[]; mine: City[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(mine.map((c) => c.id));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  const byState = useMemo(() => {
    const groups = new Map<string, City[]>();
    for (const city of all) {
      if (!city.isActive) continue;
      const list = groups.get(city.state) ?? [];
      list.push(city);
      groups.set(city.state, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [all]);

  const chosen = new Set(selected);
  const changed =
    selected.length !== mine.length || mine.some((c) => !chosen.has(c.id));

  function toggle(id: string) {
    setSaved(false);
    setSelected((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
    );
  }

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await setServiceAreasAction(selected);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-ink-3">
        Tick every district you will travel to. Leads are offered to you only in these
        districts — anything unticked stops reaching you.
      </p>

      <div className="mt-4 space-y-4">
        {byState.map(([state, districts]) => (
          <fieldset key={state}>
            <legend className="text-[11.5px] uppercase tracking-wider text-ink-4">{state}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {districts.map((district) => {
                const on = chosen.has(district.id);
                return (
                  <label
                    key={district.id}
                    className={
                      on
                        ? "cursor-pointer rounded-full border border-brand bg-brand-soft px-3 py-1.5 text-[13px] text-brand"
                        : "cursor-pointer rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-surface-2"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(district.id)}
                      className="sr-only"
                    />
                    {district.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !changed || selected.length === 0}
          onClick={save}
          className="rounded-full bg-brand px-4 py-1.5 text-[13px] font-medium text-white hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save districts"}
        </button>

        {selected.length === 0 ? (
          <span className="text-[12.5px] text-danger">
            Choose at least one — with none, no work can reach you.
          </span>
        ) : null}

        {saved && !changed ? (
          <span className="text-[12.5px] text-positive">Saved.</span>
        ) : null}

        {error ? (
          <span role="alert" className="text-[12.5px] text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
