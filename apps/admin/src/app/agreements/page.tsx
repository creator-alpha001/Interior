import Link from "next/link";
import { formatRupees, listAllAgreements, listDomains } from "@repo/data";
import { Badge, agreementStatus, formatDate } from "@repo/ui";
import { DataTable, FilterBar, FilterGroup, Metric, PageBody, PageHeader } from "@/components/ops-ui";

export const metadata = { title: "Agreements" };

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; domain?: string }>;
}) {
  const sp = await searchParams;
  const [domains, all, rows] = await Promise.all([
    listDomains(),
    listAllAgreements(),
    listAllAgreements({ status: sp.status, domainSlug: sp.domain }),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...sp, ...patch })) {
      if (value && value !== "all") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/agreements?${qs}` : "/agreements";
  };

  const combined = all.filter((a) => a.isCombined).length;
  const totalValue = all.reduce((sum, a) => sum + a.agreement.totalValue, 0);

  return (
    <>
      <PageHeader
        title="Agreements"
        subtitle="Grouped by professional, never by service — the rule that decides one contract or two."
      />

      <PageBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Agreements" value={all.length} hint={`${combined} combined`} />
          <Metric label="Total value" value={formatRupees(totalValue)} hint="Across all statuses" />
          <Metric
            label="Awaiting signature"
            value={all.filter((a) => ["draft", "sent"].includes(a.agreement.status)).length}
            hint="Client has not signed"
          />
          <Metric
            label="Active"
            value={all.filter((a) => a.agreement.status === "active").length}
            hint="Work in progress"
            tone="positive"
          />
        </div>

        <FilterBar>
          <FilterGroup
            label="Status"
            current={sp.status ?? "all"}
            hrefFor={(value) => href({ status: value })}
            options={[
              { value: "all", label: "All", count: all.length },
              { value: "sent", label: "Sent", count: all.filter((a) => a.agreement.status === "sent").length },
              { value: "active", label: "Active", count: all.filter((a) => a.agreement.status === "active").length },
              { value: "completed", label: "Completed", count: all.filter((a) => a.agreement.status === "completed").length },
            ]}
          />
          <FilterGroup
            label="Service"
            current={sp.domain ?? "all"}
            hrefFor={(value) => href({ domain: value })}
            options={[
              { value: "all", label: "All" },
              ...domains.map((d) => ({ value: d.slug, label: d.name })),
            ]}
          />
        </FilterBar>

        <DataTable
          rows={rows}
          rowKey={(row) => row.agreement.id}
          empty="No agreements match these filters."
          columns={[
            {
              key: "ref",
              header: "Agreement",
              render: (row) => (
                <>
                  <div className="font-mono text-[12px] text-ink-2">{row.agreement.reference}</div>
                  <div className="mt-0.5 text-[11.5px] text-ink-4">
                    {row.agreement.signedAt
                      ? `Signed ${formatDate(row.agreement.signedAt)}`
                      : "Unsigned"}
                  </div>
                </>
              ),
            },
            {
              key: "client",
              header: "Client",
              render: (row) => (
                <span className="text-[13px] text-ink">{row.client.name}</span>
              ),
            },
            {
              key: "vendor",
              header: "Professional",
              width: "20%",
              render: (row) => (
                <Link
                  href={`/vendors/${row.professional.id}`}
                  className="text-[13px] font-medium text-ink hover:text-brand"
                >
                  {row.professional.companyName}
                </Link>
              ),
            },
            {
              key: "covers",
              header: "Covers",
              width: "22%",
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.lines.map((line) => (
                    <Badge key={line.link.id} tone="neutral">
                      {line.domain.name}
                    </Badge>
                  ))}
                  {row.isCombined ? <Badge tone="brand">Combined</Badge> : null}
                </div>
              ),
            },
            {
              key: "value",
              header: "Value",
              align: "right",
              render: (row) => (
                <span className="tnum text-[13.5px] font-medium text-ink">
                  {formatRupees(row.agreement.totalValue)}
                </span>
              ),
            },
            {
              key: "invoice",
              header: "Invoice",
              align: "right",
              render: (row) =>
                row.invoice ? (
                  <span className="tnum text-[12.5px] text-brand">
                    {formatRupees(row.invoice.amount)}
                  </span>
                ) : (
                  <span className="text-[12px] text-ink-4">—</span>
                ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => {
                const status = agreementStatus[row.agreement.status];
                return <Badge tone={status.tone}>{status.label}</Badge>;
              },
            },
          ]}
        />

        <p className="text-[12px] leading-relaxed text-ink-4">
          A client choosing different professionals for different services gets one agreement per
          professional. A client choosing the same professional across several services gets a
          single combined agreement — one contract, one invoice — while execution stays tracked per
          service, because a painting job finishing does not mean the furniture job has.
        </p>
      </PageBody>
    </>
  );
}
