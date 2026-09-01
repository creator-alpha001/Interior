import { formatRupees, formatRupeesShort, listVendorInvoices, listVendorProjects } from "@repo/data";
import { Badge, formatDate, invoiceStatus } from "@repo/ui";
import { Metric, PageBody, PageHeader, Panel } from "@/components/panel-ui";
import { CURRENT_PROFESSIONAL_ID } from "@/lib/session";

export const metadata = { title: "Payments" };

export default async function VendorPaymentsPage() {
  const [invoices, projects] = await Promise.all([
    listVendorInvoices(CURRENT_PROFESSIONAL_ID),
    listVendorProjects(CURRENT_PROFESSIONAL_ID),
  ]);

  const sum = (status: string) =>
    invoices
      .filter((r) => r.invoice.status === status)
      .reduce((total, r) => total + r.invoice.amount, 0);

  const earned = projects
    .filter((p) => p.project.status !== "cancelled")
    .reduce((total, p) => total + p.project.value, 0);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="What you have earned, and what you owe us in commission."
      />

      <PageBody className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Work value" value={formatRupeesShort(earned)} hint="Across all your jobs" />
          <Metric label="Commission due" value={formatRupeesShort(sum("pending"))} hint="Not yet paid" />
          <Metric
            label="Overdue"
            value={formatRupeesShort(sum("overdue"))}
            tone={sum("overdue") > 0 ? "urgent" : "default"}
            hint="Please settle these"
          />
          <Metric label="Paid" value={formatRupeesShort(sum("paid"))} tone="positive" hint="Settled" />
        </div>

        <div className="rounded-lg border border-brand-line bg-brand-soft p-4">
          <h2 className="text-[13px] font-semibold text-brand">How you get paid</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">
            The customer pays you directly, on the terms written into your agreement. Aangan does
            not hold your money. What you owe us is commission — calculated on the agreed price when
            the agreement was signed, at your rate for that trade, and invoiced once per agreement.
            A customer who hired you for two services under one contract is one invoice, not two.
          </p>
        </div>

        <Panel title={`Commission invoices (${invoices.length})`} bodyClassName="p-0">
          {invoices.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">
              Nothing owed. Invoices are raised when an agreement is signed.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {invoices.map(({ invoice, agreementReference, domains }) => {
                const status = invoiceStatus[invoice.status];
                return (
                  <li key={invoice.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11.5px] text-ink-4">
                            {invoice.reference}
                          </span>
                          <Badge tone={status.tone}>{status.label}</Badge>
                          {domains.length > 1 ? <Badge tone="brand">Combined</Badge> : null}
                        </div>
                        <p className="mt-1 text-[12.5px] text-ink-2">
                          {agreementReference} · {domains.join(" + ")}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-ink-4">
                          {invoice.status === "paid"
                            ? `Paid ${formatDate(invoice.paidDate)}`
                            : `Due ${formatDate(invoice.dueDate)}`}
                        </p>
                        {invoice.adjustmentNote ? (
                          <p className="mt-1 text-[11.5px] italic text-ink-3">
                            {invoice.adjustmentNote}
                          </p>
                        ) : null}
                      </div>
                      <span className="tnum text-[15px] font-semibold text-ink">
                        {formatRupees(invoice.amount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Earnings by job" bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {projects.map(({ project, domain, client }) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-ink">{client.displayName}</span>
                    <Badge tone="neutral">{domain.name}</Badge>
                  </div>
                  <p className="text-[11.5px] text-ink-4">{project.reference}</p>
                </div>
                <div className="text-right">
                  <div className="tnum text-[13.5px] font-medium text-ink">
                    {formatRupees(project.value)}
                  </div>
                  <div className="text-[11px] text-ink-4">
                    less {formatRupees(project.commissionAmount)} commission
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </PageBody>
    </>
  );
}
