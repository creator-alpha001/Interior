import type { Metadata } from "next";
import Link from "next/link";
import { domainById, listDomains, listPortfolio, listProfessionals } from "@repo/data";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Container,
  EmptyState,
  Section,
} from "@repo/ui";
import { Media, cn } from "@repo/ui";

export const metadata: Metadata = {
  title: "Our work",
  description:
    "Completed interiors, furniture, fabrication and painting projects by verified professionals — filter by trade to see the work that matters to you.",
};

export default async function OurWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain: domainSlug } = await searchParams;
  const [domains, items] = await Promise.all([listDomains(), listPortfolio(domainSlug)]);

  // Portfolio entries carry a professional id, so each piece of work links back
  // to the person who actually did it rather than floating free.
  const pros = (await listProfessionals({ verifiedOnly: true, limit: 200 })).items;
  const proById = new Map(pros.map((p) => [p.id, p]));

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Our work" }]} />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[44px]">
            Work delivered, not renders
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            Every project here was completed by a verified professional on the platform, and every
            photo is moderated before it appears. Filter by trade — a painter&apos;s work should not
            be judged against a fabricator&apos;s.
          </p>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-line pb-6">
            <Link
              href="/our-work"
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                !domainSlug
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-2 hover:border-ink-4",
              )}
            >
              All trades
            </Link>
            {domains.map((d) => (
              <Link
                key={d.id}
                href={`/our-work?domain=${d.slug}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                  domainSlug === d.slug
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-2 hover:border-ink-4",
                )}
              >
                {d.name}
              </Link>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="No work published for this trade yet"
              description="We are still building the portfolio here. In the meantime, tell us what you need and we will put three professionals in front of you."
              action={<ButtonLink href="/submit-requirement">Get free quotes</ButtonLink>}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const pro = proById.get(item.professionalId);
                const domain = domainById(item.domainId);
                return (
                  <figure
                    key={item.id}
                    className="group overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-lift)]"
                  >
                    <div className="aspect-[4/3] overflow-hidden">
                      <Media
                        src={item.media[0]?.url ?? "ph:default:x"}
                        alt={item.title}
                        rounded={false}
                      />
                    </div>
                    <figcaption className="p-5">
                      <Badge tone="neutral">{domain.name}</Badge>
                      <h2 className="mt-2.5 font-display text-[20px] leading-tight text-ink">
                        {item.title}
                      </h2>
                      <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
                        {item.description}
                      </p>
                      {pro ? (
                        <Link
                          href={`/professionals/${pro.id}`}
                          className="mt-4 flex items-center gap-2.5 border-t border-line pt-3.5 text-[14px] sm:text-[13px] text-ink-2 transition-colors hover:text-brand"
                        >
                          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-[13px] sm:text-[12px] font-medium text-brand">
                            {pro.name.charAt(0)}
                          </span>
                          <span className="truncate">{pro.companyName}</span>
                          <span className="ml-auto shrink-0 text-[13px] sm:text-[12px] text-ink-4">
                            {pro.city.name}
                          </span>
                        </Link>
                      ) : null}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          )}
        </Container>
      </Section>

      <Section tone="brand">
        <Container width="default">
          <div className="text-center">
            <h2 className="text-[30px] text-white sm:text-[36px]">Want something like this?</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/70">
              Tell us what you have in mind. Three verified professionals will visit, measure and
              quote — free, and with no obligation.
            </p>
            <div className="mt-8">
              <ButtonLink href="/submit-requirement" variant="onDark" size="lg">
                Get free quotes
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
