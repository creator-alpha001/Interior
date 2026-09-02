import type { Metadata } from "next";
import Link from "next/link";
import { listCities, listDomains, listProfessionals } from "@repo/data";
import { ProfessionalCard } from "@/components/cards";
import {
  Breadcrumbs,
  Container,
  EmptyState,
  Section,
} from "@repo/ui";
import { cn } from "@repo/ui";

export const metadata: Metadata = {
  title: "Professionals",
  description:
    "Verified interior designers, furniture makers, fabricators and painters — rated per trade, not on a single blended average.",
};

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; city?: string }>;
}) {
  const { domain: domainSlug, city: cityId } = await searchParams;
  const [domains, cities, pros] = await Promise.all([
    listDomains(),
    listCities(),
    listProfessionals({ domainSlug, cityId, verifiedOnly: true }),
  ]);

  const activeDomain = domains.find((d) => d.slug === domainSlug);
  const link = (next: { domain?: string; city?: string }) => {
    const p = new URLSearchParams();
    const d = next.domain ?? domainSlug;
    const c = next.city ?? cityId;
    if (next.domain !== "" && d) p.set("domain", d);
    if (next.city !== "" && c) p.set("city", c);
    const qs = p.toString();
    return qs ? `/professionals?${qs}` : "/professionals";
  };

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Professionals" }]} />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[44px]">
            Verified, and rated per trade
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            A vendor who is excellent at painting and average at carpentry shows exactly that here.
            Approval is granted per service, so a fabricator cannot start taking painting leads
            without being separately verified for it.
          </p>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <div className="mb-8 space-y-4 border-b border-line pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Service</span>
              <Link
                href={link({ domain: "" })}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                  !domainSlug
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-2 hover:border-ink-4",
                )}
              >
                All
              </Link>
              {domains.map((d) => (
                <Link
                  key={d.id}
                  href={link({ domain: d.slug })}
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

            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">City</span>
              <Link
                href={link({ city: "" })}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                  !cityId
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-2 hover:border-ink-4",
                )}
              >
                All cities
              </Link>
              {cities.map((c) => (
                <Link
                  key={c.id}
                  href={link({ city: c.id })}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                    cityId === c.id
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-ink-2 hover:border-ink-4",
                  )}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>

          {pros.length === 0 ? (
            <EmptyState
              title="No professionals match this filter"
              description="We are still building the vendor pool for this combination. Submit your requirement anyway — our team sources and verifies vendors for new areas continuously."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {pros.map((pro) => (
                <ProfessionalCard key={pro.id} pro={pro} contextDomain={activeDomain?.name} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
