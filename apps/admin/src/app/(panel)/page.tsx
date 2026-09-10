import Link from "next/link";
import { formatRupees, formatRupeesShort, getAdminDashboard } from "@repo/data";
import { Badge } from "@repo/ui";
import { DataTable, Metric, PageBody, PageHeader, Panel } from "@/components/ops-ui";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboardPage() {
  const data = await getAdminDashboard();
  const maxRevenue = Math.max(...data.byDomain.map((d) => d.revenue), 1);

  return (
    <>
      <PageHeader
        title="Platform dashboard"
        subtitle="Where leads come from, which trade earns, and what is owed."
      />

      <PageBody className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Active leads"
            value={data.totals.activeLeads}
            hint={`${data.totals.leads} all time`}
            href="/leads"
          />
          <Metric
            label="Revenue booked"
            value={formatRupeesShort(data.totals.revenue)}
            hint="Value of signed work"
          />
          <Metric
            label="Commission pending"
            value={formatRupeesShort(data.totals.commissionPending)}
            hint={`${formatRupeesShort(data.totals.commissionOverdue)} overdue`}
            tone={data.totals.commissionOverdue > 0 ? "urgent" : "default"}
            href="/commission"
          />
          <Metric
            label="Vendors to verify"
            value={data.totals.pendingVerification}
            hint={`${data.totals.vendors} verified`}
            tone={data.totals.pendingVerification > 0 ? "urgent" : "default"}
            href="/vendors?status=pending"
          />
        </div>

        {/* The reason the multi-domain model exists: see each vertical separately. */}
        <Panel
          title="By service"
          action={
            <Link href="/reports" className="text-[12px] font-medium text-brand">
              Full reports →
            </Link>
          }
          bodyClassName="p-0"
        >
          <DataTable
            rows={data.byDomain}
            rowKey={(row) => row.domain.id}
            columns={[
              {
                key: "domain",
                header: "Service",
                width: "22%",
                render: (row) => (
                  <>
                    <div className="text-[13.5px] font-medium text-ink">{row.domain.name}</div>
                    <div className="mt-1 h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(row.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-ink-4">
                      {row.vendors} approved vendors
                    </div>
                  </>
                ),
              },
              {
                key: "leads",
                header: "Leads",
                align: "right",
                render: (row) => <span className="tnum">{row.leads}</span>,
              },
              {
                key: "quoted",
                header: "Quoted",
                align: "right",
                render: (row) => <span className="tnum text-ink-2">{row.quoted}</span>,
              },
              {
                key: "won",
                header: "Won",
                align: "right",
                render: (row) => <span className="tnum text-ink-2">{row.won}</span>,
              },
              {
                key: "conversion",
                header: "Conversion",
                align: "right",
                render: (row) => (
                  <Badge
                    tone={
                      row.conversionPercent >= 50
                        ? "positive"
                        : row.conversionPercent >= 25
                          ? "neutral"
                          : "warning"
                    }
                  >
                    {row.conversionPercent}%
                  </Badge>
                ),
              },
              {
                key: "ticket",
                header: "Avg ticket",
                align: "right",
                render: (row) => (
                  <span className="tnum text-ink-2">
                    {row.avgTicket ? formatRupeesShort(row.avgTicket) : "—"}
                  </span>
                ),
              },
              {
                key: "revenue",
                header: "Revenue",
                align: "right",
                render: (row) => (
                  <span className="tnum font-medium text-ink">
                    {formatRupeesShort(row.revenue)}
                  </span>
                ),
              },
              {
                key: "commission",
                header: "Commission",
                align: "right",
                render: (row) => (
                  <span className="tnum text-brand">{formatRupeesShort(row.commission)}</span>
                ),
              },
            ]}
          />
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="By city" bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {data.byCity.map((city) => (
                <li
                  key={city.cityName}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="text-[13px] text-ink-2">{city.cityName}</span>
                  <div className="flex items-center gap-5">
                    <span className="tnum text-[12.5px] text-ink-3">{city.leads} leads</span>
                    <span className="tnum w-20 text-right text-[13px] font-medium text-ink">
                      {city.revenue ? formatRupeesShort(city.revenue) : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Needs attention" bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {[
                {
                  label: "Commission overdue",
                  value: formatRupees(data.totals.commissionOverdue),
                  href: "/commission?status=overdue",
                  urgent: data.totals.commissionOverdue > 0,
                },
                {
                  label: "Vendors awaiting verification",
                  value: String(data.totals.pendingVerification),
                  href: "/vendors?status=pending",
                  urgent: data.totals.pendingVerification > 0,
                },
                {
                  label: "Open support tickets",
                  value: String(data.totals.openTickets),
                  href: "/support",
                  urgent: data.totals.openTickets > 0,
                },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                  >
                    <span className="text-[13px] text-ink-2">{item.label}</span>
                    <span
                      className={
                        item.urgent
                          ? "tnum text-[13.5px] font-semibold text-danger"
                          : "tnum text-[13.5px] text-ink-3"
                      }
                    >
                      {item.value}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
