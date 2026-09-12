"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { City, State } from "@repo/types";
import {
  createDistrictAction,
  createStateAction,
  updateDistrictAction,
  updateStateAction,
} from "@/app/actions";

export interface DistrictUsage {
  customers: number;
  vendors: number;
  liveLeads: number;
  prices: number;
  postedWork: number;
}

/**
 * States on the left, the districts of the selected one on the right.
 *
 * Two panes rather than one long list, because the question is always "what do
 * we cover in this state" — and because a district cannot exist without a
 * state, which a stepwise layout makes obvious rather than a rule to remember.
 */
export function LocationManager({
  states,
  districts,
  usage,
}: {
  states: State[];
  districts: City[];
  usage: Record<string, DistrictUsage>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | undefined>(states[0]?.id);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [stateName, setStateName] = useState("");
  const [districtName, setDistrictName] = useState("");

  const inState = useMemo(
    () => districts.filter((d) => d.stateId === selected),
    [districts, selected],
  );

  const countByState = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of districts) counts[d.stateId] = (counts[d.stateId] ?? 0) + 1;
    return counts;
  }, [districts]);

  function run(work: () => Promise<unknown>, after?: () => void) {
    setError(undefined);
    startTransition(async () => {
      try {
        await work();
        after?.();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "That did not save");
      }
    });
  }

  const current = states.find((s) => s.id === selected);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="rounded-lg border border-line bg-surface">
        <header className="border-b border-line px-4 py-3">
          <h2 className="text-[13px] font-semibold text-ink">States</h2>
          <p className="mt-0.5 text-[12px] text-ink-3">Pick one to see its districts.</p>
        </header>

        <ul className="divide-y divide-line">
          {states.map((state) => (
            <li key={state.id}>
              <button
                type="button"
                onClick={() => setSelected(state.id)}
                className={
                  selected === state.id
                    ? "flex w-full items-center justify-between bg-surface-2 px-4 py-2.5 text-left text-[13px] font-medium text-ink"
                    : "flex w-full items-center justify-between px-4 py-2.5 text-left text-[13px] text-ink-2 transition-colors hover:bg-surface-2"
                }
              >
                <span className="flex items-center gap-2">
                  {state.name}
                  {state.isActive ? null : (
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-4">
                      Off
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-ink-4">{countByState[state.id] ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 border-t border-line p-3">
          <input
            value={stateName}
            onChange={(e) => setStateName(e.target.value)}
            placeholder="Add a state"
            aria-label="New state name"
            className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-brand"
          />
          <button
            type="button"
            disabled={pending || stateName.trim().length === 0}
            onClick={() => run(() => createStateAction(stateName.trim()), () => setStateName(""))}
            className="rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[13px] font-semibold text-ink">
              Districts in {current?.name ?? "—"}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              What customers choose, what vendors cover, and what prices attach to.
            </p>
          </div>
          {current ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => updateStateAction(current.id, { isActive: !current.isActive }))}
              className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2 disabled:opacity-50"
            >
              {current.isActive ? "Switch state off" : "Switch state on"}
            </button>
          ) : null}
        </header>

        {current ? (
          <>
            <ul className="divide-y divide-line">
              {inState.length === 0 ? (
                <li className="px-4 py-6 text-center text-[13px] text-ink-3">
                  No districts here yet. Add the first one below.
                </li>
              ) : (
                inState.map((district) => (
                  <DistrictRow
                    key={district.id}
                    district={district}
                    usage={usage[district.id]}
                    pending={pending}
                    onToggle={(isActive) => run(() => updateDistrictAction(district.id, { isActive }))}
                    onRename={(name) => run(() => updateDistrictAction(district.id, { name }))}
                  />
                ))
              )}
            </ul>

            <div className="flex gap-2 border-t border-line p-3">
              <input
                value={districtName}
                onChange={(e) => setDistrictName(e.target.value)}
                placeholder="Add a district"
                aria-label="New district name"
                className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-brand"
              />
              <button
                type="button"
                disabled={pending || districtName.trim().length === 0}
                onClick={() =>
                  run(
                    () => createDistrictAction({ name: districtName.trim(), stateId: current.id }),
                    () => setDistrictName(""),
                  )
                }
                className="rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </>
        ) : (
          <p className="px-4 py-6 text-center text-[13px] text-ink-3">Add a state to begin.</p>
        )}

        {error ? (
          <p role="alert" className="border-t border-line px-4 py-2 text-[12.5px] text-danger">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}

/**
 * One district, with what is attached to it.
 *
 * The counts are the point of the row. Switching off a district that has live
 * jobs in it is a decision somebody should make knowingly, so the numbers sit
 * beside the button rather than behind a confirmation nobody reads.
 */
function DistrictRow({
  district,
  usage,
  pending,
  onToggle,
  onRename,
}: {
  district: City;
  usage?: DistrictUsage;
  pending: boolean;
  onToggle: (isActive: boolean) => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(district.name);

  const attached = usage
    ? [
        usage.customers ? `${usage.customers} customers` : null,
        usage.vendors ? `${usage.vendors} vendors` : null,
        usage.liveLeads ? `${usage.liveLeads} live jobs` : null,
        usage.prices ? `${usage.prices} prices` : null,
        usage.postedWork ? `${usage.postedWork} posted jobs` : null,
      ].filter(Boolean)
    : [];

  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label={`Rename ${district.name}`}
              className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-[13px] outline-none focus:border-brand"
            />
            <button
              type="button"
              disabled={pending || name.trim().length === 0}
              onClick={() => {
                onRename(name.trim());
                setEditing(false);
              }}
              className="rounded-full bg-brand px-3 py-1 text-[12.5px] font-medium text-white disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setName(district.name);
                setEditing(false);
              }}
              className="px-2 text-[12.5px] text-ink-3"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <p className="flex items-center gap-2 text-[13px] text-ink">
              {district.name}
              {district.isActive ? null : (
                <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[11px] text-ink-4">
                  Off
                </span>
              )}
            </p>
            <p className="text-[12px] text-ink-4">
              {attached.length > 0 ? attached.join(" · ") : "Nothing attached yet"}
            </p>
          </>
        )}
      </div>

      {editing ? null : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2"
          >
            Rename
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => onToggle(!district.isActive)}
            className="rounded-full border border-line px-3 py-1 text-[12.5px] text-ink-2 hover:bg-surface-2 disabled:opacity-50"
          >
            {district.isActive ? "Switch off" : "Switch on"}
          </button>
        </div>
      )}
    </li>
  );
}
