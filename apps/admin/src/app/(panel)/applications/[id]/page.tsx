import { notFound } from "next/navigation";
import { getProfessionalApplication } from "@repo/data";
import { Badge, formatDateTime } from "@repo/ui";
import { ApplicationReview } from "@/components/application-review";
import { PageBody, PageHeader, Panel } from "@/components/ops-ui";

type Params = { id: string };

const statusLabel = {
  submitted: "Waiting",
  under_review: "Being reviewed",
  changes_requested: "With applicant",
  approved: "Approved",
  rejected: "Rejected",
} as const;

const statusTone = {
  submitted: "warning",
  under_review: "brand",
  changes_requested: "clay",
  approved: "positive",
  rejected: "neutral",
} as const;

export default async function ApplicationDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const view = await getProfessionalApplication(id);
  if (!view) notFound();

  const { application } = view;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Applications", href: "/applications" },
          { label: application.companyName },
        ]}
        title={application.companyName}
        subtitle={`${view.applicantName} · applied ${formatDateTime(application.submittedAt)}`}
        actions={<Badge tone={statusTone[application.status]}>{statusLabel[application.status]}</Badge>}
      />

      <PageBody className="space-y-5">
        <ApplicationReview application={application} requestedDomains={view.requestedDomains} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="The business">
            <dl className="space-y-3">
              <Row label="Business name" value={application.companyName} />
              <Row label="Years in the trade" value={`${application.experienceYears}`} />
              <Row label="GST" value={application.gstNumber ?? "Not registered / not given"} />
              <Row
                label="Trades asked for"
                value={view.requestedDomains.map((d) => d.name).join(", ") || "—"}
              />
              <Row
                label="Cities"
                value={view.serviceCities.map((c) => c.name).join(", ") || "—"}
              />
              {application.serviceAreaNote ? (
                <Row label="Localities, in their words" value={application.serviceAreaNote} />
              ) : null}
            </dl>
          </Panel>

          <Panel title="Who is asking">
            <dl className="space-y-3">
              <Row label="Account" value={view.applicantName} />
              <Row label="Ask for" value={application.contactName} />
              <Row label="Mobile" value={application.contactMobile ?? "Not given"} />
              <Row label="Email" value={view.applicantEmail ?? "Not given"} />
              {/*
                Ops context rather than a credential: somebody who has raised
                requirements here as a customer is a known quantity, and it is
                worth seeing that before ringing them.
              */}
              <Row
                label="History as a customer"
                value={
                  view.requirementsRaised > 0
                    ? `${view.requirementsRaised} ${
                        view.requirementsRaised === 1 ? "requirement" : "requirements"
                      } raised`
                    : "No requirements raised"
                }
              />
              {application.decidedAt ? (
                <Row label="Decided" value={formatDateTime(application.decidedAt)} />
              ) : null}
            </dl>
          </Panel>
        </div>

        <Panel title="What they do">
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">
            {application.bio || "They wrote nothing here."}
          </p>
        </Panel>

        {application.reviewerNote && application.status === "changes_requested" ? (
          <Panel title="What we asked for">
            <p className="text-[13.5px] leading-relaxed text-ink-2">{application.reviewerNote}</p>
            <p className="mt-2 text-[12px] text-ink-4">
              Sent {formatDateTime(application.decidedAt)}. Waiting on them to send it back.
            </p>
          </Panel>
        ) : null}
      </PageBody>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="max-w-[60%] text-right text-[13px] text-ink">{value}</dd>
    </div>
  );
}
