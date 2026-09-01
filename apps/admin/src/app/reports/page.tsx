import { formatRupees, formatRupeesShort, getAdminDashboard, listOpsLeads } from "@repo/data";
import { Badge, urgencyLabel } from "@repo/ui";
import { DataTable, Metric, PageBody, PageHeader, Panel } from "@/components/ops-ui";

export const metadata = { title: "Reports" };

/**
 * Domain-wise reporting is the single most valuable thing the multi-domain
 * model buys the business: it says where to spend marketing money and where to
 * recruit vendors, rather than averaging four different trades into one number.
 */
export default async function ReportsPage() {
  const [data, leads] = await Promise.all([getAdminDashboard(), listOpsLeads({})]);

  const bySource = Object.entries(
    leads.reduce<Record<string, number>>((acc, row) => {
      const key = row.lead.lead.source;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const byUrgency = (["immediate", "within_month", "exploring"] as const).map((urgency) => ({
    urgency,
    count: leads.filter((r) => r.lead.lead.urgency === urgency).length,
  }));

  const multiDomain = leads.filter((r) => r.lead.isMultiDomain).length;
  const maxCityLeads = Math.max(...data.byCity.map((c) => c.leads), 1);

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Which trade earns, which converts, and where the demand is coming from."
      />

      <PageBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Total leads" value={data.totals.leads} hint={`${multiDomain} span more than one service`} />
          <Metric label="Revenue booked" value={formatRupeesShort(data.totals.revenue)} />
          <Metric label="Commission billed" value={formatRupeesShort(data.totals.commissionBilled)} />
          <Metric
            label="Multi-service share"
            value={`${Math.round((multiDomain / Math.max(leads.length, 1)) * 100)}%`}
            hint="Customers buying more than one trade"
          />
        </div>

        <Panel title="Performance by service" bodyClassName="p-0">
          <DataTable
            rows={data.byDomain}
            rowKey={(row) => row.domain.id}
            columns={[
              { key: "domain", header: "Service", render: (row) => <span className="text-[13.5px] font-medium text-ink">{row.domain.name}</span> },
              { key: "leads", header: "Leads", align: "right", render: (row) => <span className="tnum">{row.leads}</span> },
              { key: "quoted", header: "Reached quote", align: "right", render: (row) => <span className="tnum text-ink-2">{row.quoted}</span> },
              { key: "won", header: "Won", align: "right", render: (row) => <span className="tnum text-ink-2">{row.won}</span> },
              {
                key: "conv",
                header: "Conversion",
                align: "right",
                render: (row) => (
                  <Badge tone={row.conversionPercent >= 50 ? "positive" : row.conversionPercent >= 25 ? "neutral" : "warning"}>
                    {row.conversionPercent}%
                  </Badge>
                ),
              },
              { key: "avg", header: "Avg ticket", align: "right", render: (row) => <span className="tnum text-ink-2">{row.avgTicket ? formatRupees(row.avgTicket) : "—"}</span> },
              { key: "rev", header: "Revenue", align: "right", render: (row) => <span className="tnum font-medium text-ink">{formatRupees(row.revenue)}</span> },
              { key: "comm", header: "Commission", align: "right", render: (row) => <span className="tnum text-brand">{formatRupees(row.commission)}</span> },
              { key: "vendors", header: "Vendors", align: "right", render: (row) => <span className="tnum text-ink-2">{row.vendors}</span> },
            ]}
          />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Lead source">
            <ul className="space-y-2.5">
              {bySource.map(([source, count]) => (
                <li key={source}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12.5px] capitalize text-ink-2">
                      {source.replace("_", " ")}
                    </span>
                    <span className="tnum text-[12.5px] font-medium text-ink">{count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(count / leads.length) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Urgency mix">
            <ul className="space-y-2.5">
              {byUrgency.map((row) => (
                <li key={row.urgency}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12.5px] text-ink-2">{urgencyLabel[row.urgency]}</span>
                    <span className="tnum text-[12.5px] font-medium text-ink">{row.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={
                        row.urgency === "immediate"
                          ? "h-full rounded-full bg-clay"
                          : "h-full rounded-full bg-brand"
                      }
                      style={{ width: `${(row.count / Math.max(leads.length, 1)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-2.5 text-[11.5px] leading-relaxed text-ink-4">
              Immediate leads are worked first — that is the whole reason the question is on the
              form.
            </p>
          </Panel>

          <Panel title="City growth">
            <ul className="space-y-2.5">
              {data.byCity.map((city) => (
                <li key={city.cityName}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12.5px] text-ink-2">{city.cityName}</span>
                    <span className="tnum text-[12.5px] text-ink-3">
                      {city.leads} · {city.revenue ? formatRupeesShort(city.revenue) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(city.leads / maxCityLeads) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel title="What to do about it">
          <ul className="space-y-2 text-[12.5px] leading-relaxed text-ink-2">
            {data.byDomain
              .filter((d) => d.leads > 0)
              .map((d) => {
                const perVendor = d.vendors ? (d.leads / d.vendors).toFixed(1) : "—";
                const thin = d.vendors > 0 && d.leads / d.vendors > 2;
                return (
                  <li key={d.domain.id} className="flex gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                    <span>
                      <strong className="text-ink">{d.domain.name}</strong> — {d.leads} leads across{" "}
                      {d.vendors} vendors ({perVendor} per vendor).{" "}
                      {thin
                        ? "Vendor pool is thin for this demand; recruiting here would lift conversion."
                        : d.conversionPercent < 30
                          ? "Conversion is low relative to lead volume — worth checking quote quality and response times."
                          : "Supply and conversion look healthy."}
                    </span>
                  </li>
                );
              })}
          </ul>
        </Panel>
      </PageBody>
    </>
  );
}
