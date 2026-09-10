import Link from "next/link";
import type { City, LeadView, SessionUser } from "@repo/types";
import { Badge, ButtonLink, Container, formatDate, leadDomainStatus, urgencyLabel } from "@repo/ui";
import { FinishSetup } from "@/components/account/finish-setup";

/**
 * What a signed-in customer sees at the top of the home page.
 *
 * Signing in used to end on `/account`, which is the worst page on the site to
 * arrive at: for anybody who has just made an account it is three zeroes and an
 * empty list, with everything there is actually to do — the catalogue, the
 * packages, the professionals — a click away behind a nav item. Sign-in now
 * lands on the home page instead, and this is what it owes them in exchange:
 * the two setup questions, their own requirements, and the way to raise
 * another. The listings follow underneath.
 *
 * Deliberately a summary rather than a second account page. Three requirements
 * and a link, because somebody who wants the full history has an account area
 * and this is the top of a browsing page.
 */
export function CustomerHomePanel({
  session,
  cities,
  leads,
}: {
  session: SessionUser;
  cities: City[];
  leads: LeadView[];
}) {
  /*
   * Closed and archived requirements are history, not "ongoing". Matching what
   * `/account` counts as active, so the two screens cannot disagree about how
   * many things a person has on.
   */
  const ongoing = leads.filter(
    (l) => l.lead.overallStatus !== "closed" && l.lead.overallStatus !== "archived",
  );

  return (
    <div className="border-b border-line bg-surface">
      <Container width="wide" className="py-8">
        {/*
          The two questions signup let them skip. Renders nothing once both are
          answered, so this whole block quietly disappears for a settled
          account rather than becoming furniture.
        */}
        <FinishSetup session={session} cities={cities} />

        <div className="mt-5 first:mt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-[24px] leading-none">
              {ongoing.length > 0
                ? `Welcome back, ${session.name.trim().split(/\s+/)[0]}`
                : `Hello, ${session.name.trim().split(/\s+/)[0]}`}
            </h2>
            {ongoing.length > 0 ? (
              <Link
                href="/account/requirements"
                className="text-[14.5px] font-medium text-brand sm:text-[13.5px]"
              >
                All your requirements →
              </Link>
            ) : null}
          </div>

          {ongoing.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-paper p-5">
              <p className="max-w-lg text-[15px] leading-relaxed text-ink-2">
                Nothing on at the moment. Tell us what you need and we will put three verified
                professionals in front of you, each quoting the same written scope.
              </p>
              <ButtonLink href="/submit-requirement">Get free quotes</ButtonLink>
            </div>
          ) : (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {ongoing.slice(0, 3).map((lead) => (
                  <Link
                    key={lead.lead.id}
                    href={`/account/requirements/${lead.lead.id}`}
                    className="block rounded-xl border border-line bg-paper p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[12.5px] text-ink-4 sm:text-[11.5px]">
                        {lead.lead.reference}
                      </span>
                      <Badge>{urgencyLabel[lead.lead.urgency]}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-[14.5px] leading-relaxed text-ink-2">
                      {lead.lead.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                      {lead.domains.map((d) => {
                        const status = leadDomainStatus[d.leadDomain.status];
                        return (
                          <Badge key={d.leadDomain.id} tone={status.tone}>
                            {d.domain.name} · {status.label}
                          </Badge>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[12.5px] text-ink-4">
                      Raised {formatDate(lead.lead.createdAt)}
                    </p>
                  </Link>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <ButtonLink href="/submit-requirement" size="sm">
                  Add another requirement
                </ButtonLink>
                <span className="text-[13.5px] text-ink-4">
                  Each one is quoted separately, by professionals approved for that trade.
                </span>
              </div>
            </>
          )}
        </div>
      </Container>
    </div>
  );
}
