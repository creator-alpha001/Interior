import Link from "next/link";
import { formatRupees, formatRupeesShort, listCommissionInvoices } from "@repo/data";
import type { InvoiceStatus } from "@repo/types";
import { Badge, formatDate, invoiceStatus } from "@repo/ui";
import { InvoiceActions } from "@/components/invoice-actions";
import { DataTable, FilterBar, FilterGroup, Metric, PageBody, PageHeader } from "@/components/ops-ui";

export const metadata = { title: "Commission" };

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const all = await listCommissionInvoices();
  const rows = await listCommissionInvoices((sp.status as InvoiceStatus) ?? "all");

  const sum = (status: InvoiceStatus) =>
    all.filter((r) => r.invoice.status === status).reduce((total, r) => total + r.invoice.amount, 0);

  return (
    <>
      <PageHeader
        title="Commission"
        subtitle="One invoice per agreement — a vendor covering two services under one contract is billed once."
      />

      <PageBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Pending" value={formatRupeesShort(sum("pending"))} hint={`${all.filter((r) => r.invoice.status === "pending").length} invoices`} />
          <Metric
            label="Overdue"
            value={formatRupeesShort(sum("overdue"))}
            hint={`${all.filter((r) => r.invoice.status === "overdue").length} invoices`}
            tone={sum("overdue") > 0 ? "urgent" : "default"}
          />
          <Metric label="Collected" value={formatRupeesShort(sum("paid"))} hint="Paid to date" tone="positive" />
          <Metric label="Waived" value={formatRupeesShort(sum("waived"))} hint="Adjusted by admin" />
        </div>

        <FilterBar>
          <FilterGroup
            label="Status"
            current={sp.status ?? "all"}
            hrefFor={(value) => (value === "all" ? "/commission" : `/commission?status=${value}`)}
            options={[
              { value: "all", label: "All", count: all.length },
              { value: "pending", label: "Pending", count: all.filter((r) => r.invoice.status === "pending").length },
              { value: "overdue", label: "Overdue", count: all.filter((r) => r.invoice.status === "overdue").length },
              { value: "paid", label: "Paid", count: all.filter((r) => r.invoice.status === "paid").length },
              { value: "waived", label: "Waived", count: all.filter((r) => r.invoice.status === "waived").length },
            ]}
          />
        </FilterBar>

        <DataTable
          rows={rows}
          rowKey={(row) => row.invoice.id}
          empty="No invoices match this filter."
          columns={[
            {
              key: "invoice",
              header: "Invoice",
              render: (row) => (
                <>
                  <div className="font-mono text-[12px] text-ink-2">{row.invoice.reference}</div>
                  <div className="mt-0.5 text-[11.5px] text-ink-4">{row.agreementReference}</div>
                </>
              ),
            },
            {
              key: "vendor",
              header: "Vendor",
              width: "22%",
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
              render: (row) => (
                <div className="flex flex-wrap gap-1">
                  {row.domains.map((d, i) => (
                    <Badge key={`${d}-${i}`} tone="neutral">
                      {d}
                    </Badge>
                  ))}
                  {row.isCombined ? <Badge tone="brand">Combined</Badge> : null}
                </div>
              ),
            },
            {
              key: "due",
              header: "Due",
              render: (row) => (
                <>
                  <div className="text-[12.5px] text-ink-2">{formatDate(row.invoice.dueDate)}</div>
                  {row.daysOverdue > 0 ? (
                    <div className="text-[11.5px] font-medium text-danger">
                      {row.daysOverdue}d late
                    </div>
                  ) : null}
                </>
              ),
            },
            {
              key: "amount",
              header: "Amount",
              align: "right",
              render: (row) => (
                <span className="tnum text-[13.5px] font-medium text-ink">
                  {formatRupees(row.invoice.amount)}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => {
                const status = invoiceStatus[row.invoice.status];
                return (
                  <>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {row.invoice.adjustmentNote ? (
                      <p className="mt-1 max-w-[180px] text-[11px] italic text-ink-4">
                        {row.invoice.adjustmentNote}
                      </p>
                    ) : null}
                  </>
                );
              },
            },
            {
              key: "actions",
              header: "",
              align: "right",
              render: (row) => (
                <InvoiceActions invoiceId={row.invoice.id} status={row.invoice.status} />
              ),
            },
          ]}
        />

        <p className="text-[12px] leading-relaxed text-ink-4">
          Commission is calculated on the agreed price at the moment an agreement is signed, using
          the vendor&apos;s rate for that trade. Cancelled before work starts, it is waived; once
          work has begun it stands unless adjusted here, with a reason.
        </p>
      </PageBody>
    </>
  );
}
