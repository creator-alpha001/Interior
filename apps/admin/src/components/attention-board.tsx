import Link from "next/link";
import type { AttentionCard, AttentionKey, AttentionView } from "@repo/types";
import { cn, formatDate } from "@repo/ui";

/**
 * Where each card leads.
 *
 * Kept here rather than in the API response, because these are this panel's
 * URLs: `href` is the screen that lists the whole queue, `open` is where a
 * single entry is handled.
 */
const CARDS: Record<
  AttentionKey,
  { label: string; href: string; open: (id: string | null) => string; urgent?: true }
> = {
  new_leads: {
    label: "New leads",
    href: "/leads?status=new",
    open: (id) => (id ? `/leads/${id}` : "/leads?status=new"),
  },
  awaiting_reply: {
    label: "Customers waiting on a reply",
    href: "/leads?view=awaiting",
    open: (id) => (id ? `/leads/${id}` : "/leads?view=awaiting"),
    urgent: true,
  },
  unassigned_leads: {
    label: "Leads without vendors",
    href: "/leads?view=unassigned",
    open: (id) => (id ? `/leads/${id}` : "/leads?view=unassigned"),
  },
  follow_ups: {
    label: "Follow-up calls due",
    href: "/my-day",
    open: (id) => (id ? `/leads/${id}` : "/my-day"),
    urgent: true,
  },
  applications: {
    label: "Vendor applications",
    href: "/applications",
    open: (id) => (id ? `/applications/${id}` : "/applications"),
  },
  paperwork: {
    label: "Verification paperwork",
    href: "/vendors?status=pending",
    open: (id) => (id ? `/vendors/${id}` : "/vendors?status=pending"),
  },
  trade_requests: {
    label: "Trade approval requests",
    href: "/vendors",
    open: (id) => (id ? `/vendors/${id}` : "/vendors"),
  },
  stage_proof: {
    label: "Stage photos to approve",
    href: "/leads?status=in_progress",
    open: (id) => (id ? `/leads/${id}` : "/leads?status=in_progress"),
  },
  visit_writeups: {
    label: "Visits to write up",
    href: "/visits",
    open: (id) => (id ? `/leads/${id}` : "/visits"),
  },
  reschedules: {
    label: "Reschedule requests",
    href: "/visits",
    open: (id) => (id ? `/leads/${id}` : "/visits"),
    urgent: true,
  },
  overdue_commission: {
    label: "Overdue commission",
    href: "/commission?status=overdue",
    open: () => "/commission?status=overdue",
    urgent: true,
  },
  open_tickets: {
    label: "Open support tickets",
    href: "/support?status=open",
    open: () => "/support?status=open",
    urgent: true,
  },
};

/**
 * The dashboard's second row: everything across the panel waiting on our team.
 *
 * Cards with something in them come first, in the order the work usually
 * matters; the empty ones collapse into a single line, so a quiet queue does not
 * push a busy one below the fold.
 */
export function AttentionBoard({ view }: { view: AttentionView }) {
  const active = view.cards.filter((c) => c.count > 0 || c.failed);
  const clear = view.cards.filter((c) => c.count === 0 && !c.failed);
  const total = active.reduce((sum, c) => sum + c.count, 0);

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
          Needs your attention
        </h2>
        <p className="text-[12px] text-ink-4">
          {total > 0
            ? `${total} ${total === 1 ? "item" : "items"} waiting across the panel`
            : "Nothing is waiting on the team"}
        </p>
      </div>

      {active.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {active.map((card) => (
            <AttentionCardView key={card.key} card={card} />
          ))}
        </div>
      ) : null}

      {clear.length > 0 ? (
        <p className="mt-2.5 rounded-md border border-line bg-surface px-3 py-2 text-[12px] text-ink-4">
          <span className="font-medium text-positive">All clear:</span>{" "}
          {clear.map((card, index) => (
            <span key={card.key}>
              {index > 0 ? " · " : ""}
              <Link href={CARDS[card.key].href} className="hover:text-brand">
                {CARDS[card.key].label}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}

function AttentionCardView({ card }: { card: AttentionCard }) {
  const config = CARDS[card.key];
  const more = card.count - card.entries.length;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <Link
        href={config.href}
        className="flex items-start justify-between gap-3 border-b border-line px-4 py-3 transition-colors hover:bg-surface-2"
      >
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-3">
            {config.label}
          </p>
          {card.failed ? (
            <p className="mt-0.5 text-[12px] text-danger">Could not be loaded just now</p>
          ) : card.note ? (
            <p className="mt-0.5 text-[12px] text-ink-4">{card.note}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "tnum shrink-0 font-display text-[26px] leading-none",
            card.failed ? "text-ink-4" : config.urgent ? "text-danger" : "text-ink",
          )}
        >
          {card.failed ? "—" : card.count}
        </span>
      </Link>

      <ul className="flex-1 divide-y divide-line">
        {card.entries.map((entry, index) => (
          <li key={`${entry.targetId ?? "row"}-${index}`}>
            <Link
              href={config.open(entry.targetId)}
              className="block px-4 py-2.5 transition-colors hover:bg-surface-2"
            >
              <p className="truncate text-[13px] font-medium text-ink">{entry.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-ink-3">
                {entry.detail}
                {entry.at ? ` · ${formatDate(entry.at)}` : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {more > 0 ? (
        <Link
          href={config.href}
          className="border-t border-line px-4 py-2 text-[12px] font-medium text-brand hover:bg-surface-2"
        >
          {more} more →
        </Link>
      ) : null}
    </div>
  );
}
