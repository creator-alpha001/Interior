import type { TimelineEvent, TimelineKind } from "@repo/data";
import { formatDateTime } from "@repo/ui";
import { cn } from "@repo/ui";

const kindStyle: Record<TimelineKind, { dot: string; label: string }> = {
  raised: { dot: "bg-ink-4", label: "Enquiry" },
  call: { dot: "bg-brand", label: "Call" },
  assigned: { dot: "bg-clay", label: "Assignment" },
  visit: { dot: "bg-ink-3", label: "Visit" },
  outcome: { dot: "bg-warning", label: "Outcome" },
  quote: { dot: "bg-positive", label: "Quote" },
  selected: { dot: "bg-brand", label: "Decision" },
  agreement: { dot: "bg-positive", label: "Agreement" },
};

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
        const style = kindStyle[event.kind];
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
