import Link from "next/link";
import type { LeadView } from "@repo/types";
import {
  Badge,
  ButtonLink,
  Container,
  Media,
  formatDate,
  leadDomainStatus,
  urgencyLabel,
} from "@repo/ui";

/**
 * A signed-in customer's requirements, under the hero.
 *
 * Deliberately quiet, and only there when there is something to show. It used
 * to sit above the hero with the setup questions and a "Nothing on at the
 * moment" card, so a new customer's first screen was a to-do list rather than
 * the product. Setup is now a one-line strip (`SetupNudge`) and an empty
 * account shows nothing here at all — the hero already offers "Get free design
 * quotes", which is the same invitation.
 *
 * Three requirements and a link, because somebody who wants the full history
 * has an account area and this is the top of a browsing page.
 */
export function CustomerHomePanel({ leads }: { leads: LeadView[] }) {
  /*
   * Closed and archived requirements are history, not "ongoing". Matching what
   * `/account` counts as active, so the two screens cannot disagree about how
   * many things a person has on.
   */
  const ongoing = leads.filter(
    (l) => l.lead.overallStatus !== "closed" && l.lead.overallStatus !== "archived",
  );

  if (ongoing.length === 0) return null;

  return (
    <section className="border-b border-line bg-surface">
      <Container width="wide" className="py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[18px]">Your requirements</h2>
          <Link
            href="/account/requirements"
            className="text-[14px] font-medium text-brand sm:text-[13px]"
          >
            See all →
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {ongoing.slice(0, 3).map((lead) => {
            const first = lead.domains[0]?.domain;
            return (
              <Link
                key={lead.lead.id}
                href={`/account/requirements/${lead.lead.id}`}
                className="group flex gap-4 rounded-xl border border-line bg-paper p-3 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <div className="h-20 w-24 shrink-0 overflow-hidden rounded-lg">
                  <Media
                    src={`ph:${first?.slug ?? "default"}:${lead.lead.id}`}
                    alt={first?.name ?? "Your requirement"}
                    rounded={false}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] text-ink-4">{lead.lead.reference}</span>
                    <Badge>{urgencyLabel[lead.lead.urgency]}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[14px] text-ink-2">{lead.lead.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {lead.domains.slice(0, 2).map((d) => {
                      const status = leadDomainStatus[d.leadDomain.status];
                      return (
                        <Badge key={d.leadDomain.id} tone={status.tone}>
                          {d.domain.name} · {status.label}
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[12px] text-ink-4">Raised {formatDate(lead.lead.createdAt)}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4">
          <ButtonLink href="/submit-requirement" size="sm" variant="secondary">
            Add another requirement
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
