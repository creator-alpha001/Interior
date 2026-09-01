import Link from "next/link";
import { listCities, listDomains, listOpsLeads } from "@repo/data";
import type { OpsLeadRow } from "@repo/data";
import type { LeadStatus, Urgency } from "@repo/types";
import { Badge, cn, formatDate, leadDomainStatus, urgencyLabel } from "@repo/ui";
import { LeadSearch } from "@/components/lead-search";
import { FilterBar, FilterGroup, PageBody, PageHeader } from "@/components/ops-ui";

export const metadata = { title: "Lead queue" };

type Search = {
  status?: string;
  domain?: string;
  city?: string;
  urgency?: string;
  view?: "awaiting" | "unassigned" | "stalled";
  q?: string;
};

/**
 * A queue, not a spreadsheet. Rows are grouped by what they need rather than
 * sorted by a column, because "which of these should I pick up next?" is the
 * only question anyone opens this page to answer.
 */
export default async function LeadQueuePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const [domains, cities, allLeads] = await Promise.all([
    listDomains(),
    listCities(),
    listOpsLeads({}),
  ]);

  let rows = await listOpsLeads({
    status: (sp.status as LeadStatus) ?? undefined,
    domainSlug: sp.domain,
    cityId: sp.city,
    urgency: sp.urgency as Urgency | undefined,
    search: sp.q,
    needsAssignment: sp.view === "unassigned" || undefined,
  });
  if (sp.view === "awaiting") rows = rows.filter((r) => r.awaitingReply > 0);
  if (sp.view === "stalled") rows = rows.filter((r) => r.ageDays >= 14);

  const href = (patch: Partial<Search>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...sp, ...patch })) {
      if (value && value !== "all") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/leads?${qs}` : "/leads";
  };

  // Grouped by the action they need. A lead appears once, in its most urgent group.
  const taken = new Set<string>();
  const take = (predicate: (row: OpsLeadRow) => boolean) => {
    const group = rows.filter((r) => !taken.has(r.lead.lead.id) && predicate(r));
    for (const r of group) taken.add(r.lead.lead.id);
    return group;
  };

  const groups = [
    {
      key: "reply",
      title: "Waiting on our reply",
      hint: "A client wrote and has not heard back",
      tone: "danger" as const,
      rows: take((r) => r.awaitingReply > 0),
    },
    {
      key: "assign",
      title: "Needs professionals assigned",
      hint: "Call the vendor pool, then assign whoever confirms",
      tone: "warning" as const,
      rows: take((r) => r.unassignedDomains > 0),
    },
    {
      key: "uncalled",
      title: "Not yet called",
      hint: "Scope has not been captured, so nobody can quote properly",
      tone: "warning" as const,
      rows: take((r) => !r.lastActivity && r.lead.lead.overallStatus !== "closed"),
    },
    {
      key: "moving",
      title: "In flight",
      hint: "Quotes out, or work under way",
      tone: "neutral" as const,
      rows: take(
        (r) => !["closed", "archived"].includes(r.lead.lead.overallStatus),
      ),
    },
    {
      key: "closed",
      title: "Closed",
      hint: "Completed or cancelled",
      tone: "neutral" as const,
      rows: take(() => true),
    },
  ].filter((g) => g.rows.length > 0);

  const filtered = rows.length !== allLeads.length;

  return (
    <>
      <PageHeader
        title="Lead queue"
        subtitle={
          filtered
            ? `${rows.length} of ${allLeads.length} leads match`
            : `${allLeads.length} leads · grouped by what they need`
        }
        actions={<LeadSearch initial={sp.q ?? ""} />}
      />

      <PageBody className="space-y-4">
        <FilterBar>
          <FilterGroup
            label="Needs"
            current={sp.view ?? "all"}
            hrefFor={(value) => href({ view: value === "all" ? undefined : (value as Search["view"]) })}
            options={[
              { value: "all", label: "Anything" },
              { value: "awaiting", label: "A reply", count: allLeads.filter((r) => r.awaitingReply > 0).length },
              { value: "unassigned", label: "Assignment", count: allLeads.filter((r) => r.unassignedDomains > 0).length },
              { value: "stalled", label: "Chasing", count: allLeads.filter((r) => r.ageDays >= 14).length },
            ]}
          />
          <FilterGroup
            label="Status"
            current={sp.status ?? "all"}
            hrefFor={(value) => href({ status: value === "all" ? undefined : value, view: undefined })}
            options={[
              { value: "all", label: "All" },
              { value: "new", label: "New", count: allLeads.filter((r) => r.lead.lead.overallStatus === "new").length },
              { value: "in_progress", label: "In progress", count: allLeads.filter((r) => r.lead.lead.overallStatus === "in_progress").length },
              { value: "closed", label: "Closed", count: allLeads.filter((r) => r.lead.lead.overallStatus === "closed").length },
            ]}
          />
          <FilterGroup
            label="Service"
            current={sp.domain ?? "all"}
            hrefFor={(value) => href({ domain: value === "all" ? undefined : value })}
            options={[
              { value: "all", label: "All" },
              ...domains.map((d) => ({ value: d.slug, label: d.name })),
            ]}
          />
          <FilterGroup
            label="City"
            current={sp.city ?? "all"}
            hrefFor={(value) => href({ city: value === "all" ? undefined : value })}
            options={[
              { value: "all", label: "All" },
              ...cities.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </FilterBar>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
            <p className="text-[15px] font-medium text-ink sm:text-[14px]">No leads match</p>
            <p className="mt-1.5 text-[13.5px] text-ink-3 sm:text-[12.5px]">
              Try widening the filters, or{" "}
              <Link href="/leads" className="text-brand">
                clear them all
              </Link>
              .
            </p>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.key}>
              <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink sm:text-[14px]">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      group.tone === "danger"
                        ? "bg-danger"
                        : group.tone === "warning"
                          ? "bg-warning"
                          : "bg-line-strong",
                    )}
                  />
                  {group.title}
                  <span className="tnum text-ink-4">{group.rows.length}</span>
                </h2>
                <p className="text-[13px] text-ink-4 sm:text-[12px]">{group.hint}</p>
              </header>

              <ul className="overflow-hidden rounded-lg border border-line bg-surface">
                {group.rows.map((row) => (
                  <li key={row.lead.lead.id} className="border-b border-line last:border-0">
                    <Link
                      href={`/leads/${row.lead.lead.id}`}
                      className="block px-4 py-3 transition-colors hover:bg-surface-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        {/* Who and what */}
                        <div className="min-w-0 flex-1 basis-64">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] font-semibold text-brand sm:text-[12px]">
                              {row.lead.client.name.charAt(0)}
                            </span>
                            <span className="text-[14.5px] font-medium text-ink sm:text-[13.5px]">
                              {row.lead.client.name}
                            </span>
                            <span className="font-mono text-[12px] text-ink-4 sm:text-[11.5px]">
                              {row.lead.lead.reference}
                            </span>
                            {row.lead.lead.urgency === "immediate" ? (
                              <Badge tone="danger">Immediate</Badge>
                            ) : (
                              <Badge tone="neutral">{urgencyLabel[row.lead.lead.urgency]}</Badge>
                            )}
                          </div>
                          <p className="mt-1.5 line-clamp-1 text-[13.5px] text-ink-2 sm:text-[12.5px]">
                            {row.lead.lead.description}
                          </p>
                          <p className="mt-1 text-[12.5px] text-ink-4 sm:text-[11.5px]">
                            {row.lead.client.mobile} · {row.lead.city.name} ·{" "}
                            {row.agentName ?? "no agent"}
                          </p>
                        </div>

                        {/* Per-service progress */}
                        <div className="flex min-w-0 basis-72 flex-col gap-1">
                          {row.lead.domains.map((d) => {
                            const status = leadDomainStatus[d.leadDomain.status];
                            return (
                              <div
                                key={d.leadDomain.id}
                                className="flex items-center justify-between gap-2 rounded bg-paper px-2 py-1"
                              >
                                <span className="truncate text-[13px] text-ink-2 sm:text-[12px]">
                                  {d.domain.name}
                                </span>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {d.quotes.length > 0 ? (
                                    <span className="tnum text-[12px] text-ink-4 sm:text-[11px]">
                                      {d.quotes.length}q
                                    </span>
                                  ) : null}
                                  <Badge tone={status.tone}>{status.label}</Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* What it needs, and how long it has waited */}
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {row.awaitingReply > 0 ? (
                            <Badge tone="danger">{row.awaitingReply} awaiting reply</Badge>
                          ) : null}
                          {row.unassignedDomains > 0 ? (
                            <Badge tone="warning">{row.unassignedDomains} to assign</Badge>
                          ) : null}
                          {row.followUpDate ? (
                            <span className="text-[12.5px] text-clay sm:text-[11.5px]">
                              follow up {formatDate(row.followUpDate)}
                            </span>
                          ) : null}
                          <span className="tnum text-[12.5px] text-ink-4 sm:text-[11.5px]">
                            {row.ageDays}d · {formatDate(row.lead.lead.createdAt)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </PageBody>
    </>
  );
}
