import {
  formatRupeesShort,
  hasSignedPartnerAgreement,
  listCities,
  listDomains,
  listVendors,
} from "@repo/data";
import type { VerificationStatus } from "@repo/types";
import { Badge } from "@repo/ui";
import { DataTable, FilterBar, FilterGroup, PageBody, PageHeader } from "@/components/ops-ui";

export const metadata = { title: "Vendors" };

const statusTone = {
  verified: "positive",
  pending: "warning",
  suspended: "danger",
  blacklisted: "danger",
} as const;

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; domain?: string; city?: string }>;
}) {
  const sp = await searchParams;
  const [domains, cities, all, rows] = await Promise.all([
    listDomains(),
    listCities(),
    listVendors({}),
    listVendors({
      status: (sp.status as VerificationStatus) ?? undefined,
      domainSlug: sp.domain,
      cityId: sp.city,
    }),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...sp, ...patch })) {
      if (value && value !== "all") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/vendors?${qs}` : "/vendors";
  };

  const pendingRequests = all.reduce((sum, r) => sum + r.pendingDomainRequests, 0);

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle={`${rows.length} of ${all.length} · ${pendingRequests} trade approvals waiting`}
      />

      <PageBody>
        <FilterBar>
          <FilterGroup
            label="Status"
            current={sp.status ?? "all"}
            hrefFor={(value) => href({ status: value })}
            options={[
              { value: "all", label: "All", count: all.length },
              {
                value: "verified",
                label: "Verified",
                count: all.filter((r) => r.professional.verificationStatus === "verified").length,
              },
              {
                value: "pending",
                label: "Pending",
                count: all.filter((r) => r.professional.verificationStatus === "pending").length,
              },
              {
                value: "suspended",
                label: "Suspended",
                count: all.filter((r) => r.professional.verificationStatus === "suspended").length,
              },
            ]}
          />
          <FilterGroup
            label="Trade"
            current={sp.domain ?? "all"}
            hrefFor={(value) => href({ domain: value })}
            options={[
              { value: "all", label: "All" },
              ...domains.map((d) => ({ value: d.slug, label: d.name })),
            ]}
          />
          <FilterGroup
            label="City"
            current={sp.city ?? "all"}
            hrefFor={(value) => href({ city: value })}
            options={[
              { value: "all", label: "All" },
              ...cities.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </FilterBar>

        <DataTable
          rows={rows}
          rowKey={(row) => row.professional.id}
          onRowHref={(row) => `/vendors/${row.professional.id}`}
          empty="No vendors match these filters."
          columns={[
            {
              key: "vendor",
              header: "Vendor",
              width: "24%",
              render: (row) => (
                <>
                  <div className="text-[13.5px] font-medium text-ink">
                    {row.professional.companyName}
                  </div>
                  <div className="mt-0.5 text-[12px] text-ink-3">{row.summary.name}</div>
                  <div className="mt-0.5 text-[11.5px] text-ink-4">
                    {row.serviceCities.join(", ")}
                  </div>
                </>
              ),
            },
            {
              key: "trades",
              header: "Trades approved",
              width: "26%",
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.domainLinks.map(({ link, domain }) => (
                    <Badge
                      key={link.id}
                      tone={
                        link.verificationStatus === "approved"
                          ? "brand"
                          : link.verificationStatus === "pending"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {domain.name}
                      {link.verificationStatus === "approved" ? ` ${link.avgRating.toFixed(1)}★` : ""}
                      {link.verificationStatus === "pending" ? " · requested" : ""}
                    </Badge>
                  ))}
                </div>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <div className="flex flex-col items-start gap-1">
                  <Badge tone={statusTone[row.professional.verificationStatus]}>
                    {row.professional.verificationStatus}
                  </Badge>
                  {!hasSignedPartnerAgreement(row.professional.id) ? (
                    <Badge tone="warning">Agreement unsigned</Badge>
                  ) : null}
                </div>
              ),
            },
            {
              key: "live",
              header: "Live jobs",
              align: "right",
              render: (row) => <span className="tnum">{row.liveJobs}</span>,
            },
            {
              key: "revenue",
              header: "Revenue",
              align: "right",
              render: (row) => (
                <span className="tnum text-ink-2">
                  {row.totalRevenue ? formatRupeesShort(row.totalRevenue) : "—"}
                </span>
              ),
            },
            {
              key: "owed",
              header: "Commission due",
              align: "right",
              render: (row) => (
                <span
                  className={
                    row.outstandingCommission > 0
                      ? "tnum font-medium text-danger"
                      : "tnum text-ink-4"
                  }
                >
                  {row.outstandingCommission ? formatRupeesShort(row.outstandingCommission) : "—"}
                </span>
              ),
            },
          ]}
        />
      </PageBody>
    </>
  );
}
