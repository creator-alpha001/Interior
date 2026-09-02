import Link from "next/link";
import { formatRupees, listVendorLeads } from "@repo/data";
import { Badge, formatDate, materialSourceLabel, urgencyLabel } from "@repo/ui";
import { FilterBar, FilterGroup, PageBody, PageHeader } from "@/components/partner/panel-ui";

export const metadata = { title: "Leads" };

type Filter = "all" | "new" | "quoting" | "won" | "lost";

export default async function VendorLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const filter = (sp.filter as Filter) ?? "all";

  const [all, cards] = await Promise.all([
    listVendorLeads(),
    listVendorLeads(filter),
  ]);

  const count = (f: Filter) =>
    f === "all"
      ? all.length
      : all.filter((c) => {
          if (f === "new") return c.assignment.responseStatus === "pending" || !c.myQuote;
          if (f === "quoting") return Boolean(c.myQuote) && c.leadDomain.selectedProfessionalId === null;
          if (f === "won") return c.won;
          return c.lost;
        }).length;

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Qualified before they reach you. You are one of three quoting on each."
      />

      <PageBody className="space-y-4">
        <FilterBar>
          <FilterGroup
            label="Show"
            current={filter}
            hrefFor={(value) => (value === "all" ? "/leads" : `/leads?filter=${value}`)}
            options={[
              { value: "all", label: "All", count: count("all") },
              { value: "new", label: "To quote", count: count("new") },
              { value: "quoting", label: "Quoted", count: count("quoting") },
              { value: "won", label: "Won", count: count("won") },
              { value: "lost", label: "Lost", count: count("lost") },
            ]}
          />
        </FilterBar>

        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line-strong bg-surface px-6 py-12 text-center text-[13px] text-ink-3">
            Nothing here. New leads arrive when our team assigns you to a job in a trade and city
            you cover.
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((card) => {
              const { won, lost } = card;

              return (
                <Link
                  key={card.assignment.id}
                  href={`/partner/leads/${card.leadDomain.id}`}
                  className="block rounded-lg border border-line bg-surface p-4 transition-colors hover:border-ink-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-semibold text-ink">
                          {card.client.displayName}
                        </span>
                        <Badge tone="neutral">{card.domain.name}</Badge>
                        {card.urgency === "immediate" ? (
                          <Badge tone="danger">Immediate</Badge>
                        ) : (
                          <Badge tone="neutral">{urgencyLabel[card.urgency as "exploring"]}</Badge>
                        )}
                        {won ? <Badge tone="positive">You won this</Badge> : null}
                        {lost ? <Badge tone="neutral">Went elsewhere</Badge> : null}
                      </div>

                      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-2">
                        {card.description}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-4">
                        <span>
                          {card.client.locality}, {card.client.city.name}
                        </span>
                        <span>{materialSourceLabel[card.materialSource]}</span>
                        {card.budgetMax ? (
                          <span>Budget up to {formatRupees(card.budgetMax)}</span>
                        ) : null}
                        <span>Assigned {formatDate(card.assignment.assignedAt)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {card.myQuote ? (
                        <>
                          <div className="tnum text-[15px] font-semibold text-ink">
                            {formatRupees(card.myQuote.total)}
                          </div>
                          <div className="text-[11px] text-ink-4">
                            your quote{card.myQuote.version > 1 ? ` v${card.myQuote.version}` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="inline-block rounded-full bg-brand px-3 py-1 text-[11.5px] font-medium text-white">
                          Send a quote
                        </span>
                      )}
                      {card.competingQuotes > 0 && !won && !lost ? (
                        <div className="mt-1.5 text-[11px] text-ink-4">
                          {card.competingQuotes} other{card.competingQuotes === 1 ? "" : "s"} quoted
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>
    </>
  );
}
