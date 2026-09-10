import type { Metadata } from "next";
import Link from "next/link";
import {
  getSessionUser,
  listCities,
  listDomains,
  myProfessionalApplication,
} from "@repo/data";
import { Badge, ButtonLink, Card, formatDateTime } from "@repo/ui";
import { ProfessionalApplicationForm } from "@/components/account/professional-application-form";
import { WithdrawApplicationButton } from "@/components/account/withdraw-application-button";

export const metadata: Metadata = {
  title: "Join as a professional",
  description: "Apply to receive qualified leads for the trades you work in.",
};

/**
 * The route the marketing page's "Apply to join" button should always have
 * pointed at.
 *
 * It used to point at /partner, which turns away anybody who is not already a
 * professional — so a person who wanted to sell on the platform pressed the
 * button and was returned, without a word, to the customer account area. There
 * was no application to make: professional records were created by ops directly
 * in the database, and nothing in the product could start one.
 *
 * This page is all four states of that application, because they are one
 * question — "can I work here yet?" — and a person who was refused needs the
 * reason on the same screen they would go to in order to reapply.
 */
export default async function BecomeAProfessionalPage() {
  const [existing, domains, cities, sessionUser] = await Promise.all([
    myProfessionalApplication(),
    listDomains(),
    listCities(),
    getSessionUser(),
  ]);

  const application = existing?.application;

  /*
   * Approved is worth handling even though the account layout will already have
   * sent a professional to /partner. Approval happens while they are sitting on
   * this page, and the request that carries the news is the one that renders
   * it — so this is the screen that has to say what just happened.
   */
  if (application?.status === "approved") {
    return (
      <Card>
        <Badge tone="positive">Approved</Badge>
        <h2 className="mt-3 font-display text-[24px]">You are in.</h2>
        <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-2">
          {existing?.requestedDomains.length
            ? `You have been approved to take work in ${listNames(
                existing.requestedDomains.map((d) => d.name),
              )}.`
            : "Your application has been approved."}{" "}
          Your account has moved over to the professional portal — leads, quotes, agreements and
          commission all live there now.
        </p>
        {application.reviewerNote ? (
          <p className="mt-4 rounded-lg border border-line bg-paper px-3.5 py-3 text-[14px] leading-relaxed text-ink-2">
            {application.reviewerNote}
          </p>
        ) : null}
        <div className="mt-6">
          <ButtonLink href="/partner">Go to the professional portal</ButtonLink>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-4">
          There are a few setup steps waiting — the partner agreement, your documents and your bank
          details. Leads start once those are done.
        </p>
      </Card>
    );
  }

  if (application && (application.status === "submitted" || application.status === "under_review")) {
    const underReview = application.status === "under_review";

    return (
      <div className="space-y-5">
        <Card>
          <Badge tone="warning">{underReview ? "Being reviewed" : "Application received"}</Badge>
          <h2 className="mt-3 font-display text-[24px]">
            {underReview ? "Our team is looking at this now" : "Your application is with our team"}
          </h2>
          <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-ink-2">
            Sent {formatDateTime(application.submittedAt)}. We read applications in the order they
            arrive and usually come back within two working days — by phone, on{" "}
            {application.contactMobile ?? "the number on your account"}.
          </p>

          <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
            <Detail label="Business" value={application.companyName} />
            <Detail label="Experience" value={`${application.experienceYears} years`} />
            <Detail
              label="Trades applied for"
              value={listNames(existing!.requestedDomains.map((d) => d.name))}
            />
            <Detail
              label="Cities"
              value={listNames(existing!.serviceCities.map((c) => c.name))}
            />
          </dl>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5">
          <p className="max-w-md text-[14px] leading-relaxed text-ink-3">
            Changed your mind, or sent the wrong details? Withdraw this and you can apply again
            whenever you like.
          </p>
          <WithdrawApplicationButton />
        </div>
      </div>
    );
  }

  const changesRequested = application?.status === "changes_requested";

  return (
    <div className="space-y-5">
      {changesRequested ? (
        <Card>
          <Badge tone="warning">Needs a change</Badge>
          <h2 className="mt-3 font-display text-[22px]">Our team asked for something</h2>
          <p className="mt-3 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-3 text-[14.5px] leading-relaxed text-ink-2">
            {application.reviewerNote}
          </p>
          <p className="mt-3 text-[13.5px] text-ink-4">
            Update the form below and send it again — it goes back to the same reviewer.
          </p>
        </Card>
      ) : null}

      {application?.status === "rejected" ? (
        <Card>
          <Badge tone="danger">Not approved</Badge>
          <h2 className="mt-3 font-display text-[22px]">We could not take this one on</h2>
          <p className="mt-3 rounded-lg border border-line bg-paper px-3.5 py-3 text-[14.5px] leading-relaxed text-ink-2">
            {application.reviewerNote ?? "Our team reviewed your application and could not approve it."}
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-4">
            You are welcome to apply again once that has changed. Your customer account is
            unaffected.
          </p>
        </Card>
      ) : null}

      {!application ? (
        <Card>
          <h2 className="font-display text-[24px]">Work with us</h2>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">
            Every lead you receive has been spoken to by our team and scoped on a call. There is no
            listing fee and nothing per lead — commission is charged only on work you win.
          </p>
          <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
            {[
              "Our team reads your application and rings you back, usually within two working days.",
              "Approval is per trade, so you can be approved for one and not another.",
              "Once approved, this account moves to the professional portal — your customer requirements stay on file with our team, but the account itself becomes a vendor account.",
            ].map((line) => (
              <li key={line} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-3">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[13.5px] text-ink-4">
            Want the full picture first?{" "}
            <Link href="/join-as-professional" className="font-medium text-brand">
              What we ask for, and what it costs
            </Link>
          </p>
        </Card>
      ) : null}

      <ProfessionalApplicationForm
        domains={domains}
        cities={cities}
        defaultContactName={sessionUser?.name ?? ""}
        defaultContactMobile={sessionUser?.mobile ?? null}
        previous={changesRequested ? application : undefined}
      />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-4">{label}</dt>
      <dd className="mt-1 text-[15px] text-ink">{value}</dd>
    </div>
  );
}

/** "Carpentry, Painting and Electrical" — read aloud rather than comma-listed. */
function listNames(names: string[]): string {
  if (names.length === 0) return "—";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
