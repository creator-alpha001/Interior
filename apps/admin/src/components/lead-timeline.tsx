import type { TimelineEvent, TimelineKind } from "@repo/data";
import { formatDateTime } from "@repo/ui";
import { cn } from "@repo/ui";

/**
 * Every kind the API can actually send.
 *
 * It used to list `raised`, `visit` and `outcome` — none of which exist in
 * `timelineKindSchema` — and to omit `created`, `meeting`, `message`,
 * `project`, `stage` and `review`, all of which the API does send. The lookup
 * returned undefined for a real lead and the page died on `style.dot`, taking
 * the whole screen with it. It typechecked because `@repo/data` declared a
 * second, contradictory `TimelineKind`; that duplicate is gone, so this map is
 * now exhaustive by compiler rather than by hope.
 */
const kindStyle: Record<TimelineKind, { dot: string; label: string }> = {
  created: { dot: "bg-ink-4", label: "Enquiry" },
  call: { dot: "bg-brand", label: "Call" },
  assigned: { dot: "bg-clay", label: "Assignment" },
  meeting: { dot: "bg-ink-3", label: "Visit" },
  quote: { dot: "bg-positive", label: "Quote" },
  message: { dot: "bg-ink-3", label: "Message" },
  selected: { dot: "bg-brand", label: "Decision" },
  agreement: { dot: "bg-positive", label: "Agreement" },
  project: { dot: "bg-clay", label: "Project" },
  stage: { dot: "bg-warning", label: "Stage" },
  review: { dot: "bg-positive", label: "Review" },
};

/**
 * A kind this build has never heard of still draws.
 *
 * The enum is closed and the compiler now enforces the map, so this is only
 * reachable when a deployed panel is older than the API that answered it —
 * which is a normal few minutes during any release. A neutral dot is a much
 * better outcome there than a blank screen where the lead used to be.
 */
const unknownKind = { dot: "bg-ink-4", label: "Update" } as const;

/**
 * One chronological record of the lead, newest first. Coordinators reconstruct
 * this constantly while a customer is on the phone; having it in one column
 * is the difference between answering and going to look.
 */
export function LeadTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-4 py-6 text-center text-[13.5px] text-ink-3 sm:text-[12.5px]">
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <ol className="max-h-[520px] overflow-y-auto px-4 py-3">
      {events.map((event, i) => {
        const style = kindStyle[event.kind] ?? unknownKind;
        return (
          <li key={event.id} className="flex gap-3">
            {/* Rail */}
            <div className="flex flex-col items-center">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", style.dot)} />
              {i < events.length - 1 ? <span className="w-px flex-1 bg-line" /> : null}
            </div>

            <div className={cn("min-w-0 flex-1", i < events.length - 1 && "pb-4")}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="text-[13.5px] font-medium text-ink sm:text-[12.5px]">
                  {event.title}
                </span>
                <span className="tnum shrink-0 text-[12px] text-ink-4 sm:text-[11px]">
                  {formatDateTime(event.at)}
                </span>
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11.5px] uppercase tracking-wider text-ink-4 sm:text-[10.5px]">
                  {style.label}
                </span>
                {event.domainName ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink-3 sm:text-[10.5px]">
                    {event.domainName}
                  </span>
                ) : null}
                {event.actor ? (
                  <span className="text-[11.5px] text-ink-4 sm:text-[10.5px]">{event.actor}</span>
                ) : null}
              </div>

              {event.detail ? (
                <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-ink-3 sm:text-[12px]">
                  {event.detail}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
