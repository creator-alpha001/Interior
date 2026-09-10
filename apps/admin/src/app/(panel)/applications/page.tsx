import type { ProfessionalApplicationStatus, ProfessionalApplicationView } from "@repo/types";
import { listProfessionalApplications } from "@repo/data";
import { Badge, formatDate } from "@repo/ui";
import { DataTable, FilterBar, FilterGroup, PageBody, PageHeader } from "@/components/ops-ui";

export const metadata = { title: "Applications" };

/**
 * People asking to become vendors.
 *
 * Separate from /vendors on purpose: that screen is the roster of businesses
 * that already work here, and this is a queue of decisions. Folding the two
 * together would put applicants who may be refused into every count, filter and
 * export that means "our vendors".
 */
const statusTone = {
  submitted: "warning",
  under_review: "brand",
  changes_requested: "clay",
  approved: "positive",
  rejected: "neutral",
} as const;

const statusLabel: Record<ProfessionalApplicationStatus, string> = {
  submitted: "Waiting",
  under_review: "Being reviewed",
  changes_requested: "With applicant",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = (sp.status as ProfessionalApplicationStatus | "all" | undefined) ?? "all";

  const [all, rows] = await Promise.all([
    listProfessionalApplications({}),
    listProfessionalApplications({ status }),
  ]);

  const countOf = (value: ProfessionalApplicationStatus) =>
    all.filter((r) => r.application.status === value).length;

  const waiting = countOf("submitted") + countOf("under_review");

  return (
    <>
      <PageHeader
        title="Applications"
        subtitle={
          waiting > 0
            ? `${waiting} waiting on a decision · ${all.length} in total`
            : `Nothing waiting · ${all.length} in total`
        }
      />

      <PageBody>
        <FilterBar>
          <FilterGroup
            label="Status"
            current={status}
            hrefFor={(value) => (value === "all" ? "/applications" : `/applications?status=${value}`)}
            options={[
              { value: "all", label: "All", count: all.length },
              { value: "submitted", label: "Waiting", count: countOf("submitted") },
              { value: "under_review", label: "Being reviewed", count: countOf("under_review") },
              {
                value: "changes_requested",
                label: "With applicant",
                count: countOf("changes_requested"),
              },
              { value: "approved", label: "Approved", count: countOf("approved") },
              { value: "rejected", label: "Rejected", count: countOf("rejected") },
            ]}
          />
        </FilterBar>

        <div className="mt-4">
          <DataTable<ProfessionalApplicationView>
            rows={rows}
            rowKey={(row) => row.application.id}
            onRowHref={(row) => `/applications/${row.application.id}`}
            empty={
              status === "all"
                ? "Nobody has applied yet."
                : "Nothing in this state."
            }
            columns={[
              {
                key: "business",
                header: "Business",
                render: (row) => (
                  <div>
                    <span className="font-medium text-ink">{row.application.companyName}</span>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {row.applicantName}
                      {row.application.contactMobile ? ` · ${row.application.contactMobile}` : ""}
                    </p>
                  </div>
                ),
              },
              {
                key: "trades",
                header: "Trades asked for",
                render: (row) => (
                  <div className="flex flex-wrap gap-1">
                    {row.requestedDomains.map((domain) => (
                      <Badge key={domain.id} tone="neutral">
                        {domain.name}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                key: "cities",
                header: "Cities",
                render: (row) => (
                  <span className="text-ink-2">
                    {row.serviceCities.map((c) => c.name).join(", ") || "—"}
                  </span>
                ),
              },
              {
                key: "experience",
                header: "Experience",
                align: "right",
                render: (row) => (
                  <span className="tnum text-ink-2">{row.application.experienceYears} yrs</span>
                ),
              },
              {
                key: "submitted",
                header: "Sent",
                align: "right",
                render: (row) => (
                  <span className="tnum text-ink-3">{formatDate(row.application.submittedAt)}</span>
                ),
              },
              {
                key: "status",
                header: "Status",
                align: "right",
                render: (row) => (
                  <Badge tone={statusTone[row.application.status]}>
                    {statusLabel[row.application.status]}
                  </Badge>
                ),
              },
            ]}
          />
        </div>
      </PageBody>
    </>
  );
}
