import type { Metadata } from "next";
import { listCities, listDomains, listProfessionals } from "@repo/data";
import { ProfessionalCard } from "@/components/cards";
import { FilterForm, SortSelect } from "@/components/listing/filter-form";
import {
  ActiveFilters,
  Choice,
  FilterSection,
  ListingLayout,
} from "@/components/listing/filter-parts";
import { Breadcrumbs, ButtonLink, Container, EmptyState, Media, Section } from "@repo/ui";
import { hrefWith, toRating, toWhole } from "@/lib/filters";

export const metadata: Metadata = {
  title: "Professionals",
  description:
    "Interior designers, furniture makers, fabricators and painters — rated per trade, not on a single blended average, and badged once their paperwork is verified.",
};

type Search = {
  domain?: string;
  city?: string;
  rating?: string;
  exp?: string;
  verified?: string;
  sort?: string;
};

const sorts = [
  { key: "rating", label: "Top rated" },
  { key: "experience", label: "Most experienced" },
  { key: "projects", label: "Most projects" },
] as const;

const ratings = [
  { value: "4.5", label: "4.5 ★ and above" },
  { value: "4", label: "4 ★ and above" },
  { value: "3.5", label: "3.5 ★ and above" },
];

const experience = [
  { value: "10", label: "10+ years" },
  { value: "5", label: "5+ years" },
  { value: "2", label: "2+ years" },
];

export default async function ProfessionalsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const { domain: domainSlug, city: cityId } = search;
  const sort = sorts.find((s) => s.key === search.sort)?.key ?? "rating";
  const minRating = toRating(search.rating);
  const minExperience = experience.some((e) => e.value === search.exp)
    ? toWhole(search.exp)
    : undefined;
  // Approved vendors are listed whether or not their paperwork is verified yet;
  // the badge says which. This is the customer's choice to see only the
  // badged ones, never the default.
  const verifiedOnly = search.verified === "1";

  const [domains, cities, proPage] = await Promise.all([
    listDomains(),
    listCities(),
    listProfessionals({
      domainSlug,
      cityId,
      verifiedOnly: verifiedOnly || undefined,
      minRating,
      minExperience,
      sort,
      limit: 48,
    }),
  ]);

  const pros = proPage.items;
  const activeDomain = domains.find((d) => d.slug === domainSlug);
  const activeCity = cities.find((c) => c.id === cityId);

  const base = "/professionals";
  const current: Record<string, string | undefined> = {
    domain: domainSlug,
    city: cityId,
    rating: search.rating,
    exp: search.exp,
    verified: verifiedOnly ? "1" : undefined,
    sort: search.sort,
  };

  const chips = [
    activeDomain && { label: activeDomain.name, href: hrefWith(base, current, { domain: undefined }) },
    activeCity && { label: activeCity.name, href: hrefWith(base, current, { city: undefined }) },
    verifiedOnly && { label: "Verified only", href: hrefWith(base, current, { verified: undefined }) },
    minRating && { label: `${minRating} ★ and above`, href: hrefWith(base, current, { rating: undefined }) },
    minExperience && { label: `${minExperience}+ years`, href: hrefWith(base, current, { exp: undefined }) },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));

  const filters = (
    <FilterForm key={JSON.stringify(current)} keep={{ sort: search.sort }}>
      <FilterSection title="Service">
        <Choice name="domain" value="" checked={!activeDomain} label="All services" />
        {domains.map((d) => (
          <Choice key={d.id} name="domain" value={d.slug} checked={activeDomain?.id === d.id} label={d.name} />
        ))}
      </FilterSection>

      <FilterSection title="City">
        <Choice name="city" value="" checked={!activeCity} label="All cities" />
        {cities.map((c) => (
          <Choice key={c.id} name="city" value={c.id} checked={activeCity?.id === c.id} label={c.name} />
        ))}
      </FilterSection>

      <FilterSection title="Verification">
        <Choice name="verified" value="" checked={!verifiedOnly} label="All approved professionals" />
        <Choice name="verified" value="1" checked={verifiedOnly} label="Verified only" />
      </FilterSection>

      <FilterSection title="Rating">
        <Choice name="rating" value="" checked={!minRating} label="Any rating" />
        {ratings.map((r) => (
          <Choice
            key={r.value}
            name="rating"
            value={r.value}
            checked={minRating === Number(r.value)}
            label={r.label}
          />
        ))}
      </FilterSection>

      <FilterSection title="Experience">
        <Choice name="exp" value="" checked={!minExperience} label="Any experience" />
        {experience.map((e) => (
          <Choice
            key={e.value}
            name="exp"
            value={e.value}
            checked={minExperience === Number(e.value)}
            label={e.label}
          />
        ))}
      </FilterSection>
    </FilterForm>
  );

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-8 sm:py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Professionals" }]} />
          <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,460px)]">
            <div>
              <h1 className="max-w-3xl text-[32px] leading-tight sm:text-[40px]">
                Rated per trade, badged when verified
              </h1>
              <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
                A vendor who is excellent at painting and average at carpentry shows exactly that
                here. Approval is granted per service, so a fabricator cannot start taking painting
                leads without being separately verified for it.
              </p>
              <ButtonLink href="/submit-requirement" size="lg" className="mt-6">
                Get quotes from three of them
              </ButtonLink>
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-line lg:block">
              <Media
                src="/images/stock/default/6.jpg"
                alt="A professional at work in a workshop"
                rounded={false}
                priority
                className="aspect-[4/3] w-full"
              />
            </div>
          </div>
        </Container>
      </div>

      <Section tone="paper" className="py-8 sm:py-10">
        <Container width="wide">
          <ListingLayout
            filters={filters}
            activeCount={chips.length}
            toolbar={
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px] text-ink-3 sm:text-[14px]">
                  <span className="font-semibold text-ink">{pros.length}</span>{" "}
                  {pros.length === 1 ? "professional" : "professionals"}
                  {activeCity ? ` in ${activeCity.name}` : ""}
                </p>
                <SortSelect options={[...sorts]} value={sort} params={current} />
              </div>
            }
          >
            <ActiveFilters chips={chips} clearHref={base} />

            {pros.length === 0 ? (
              <EmptyState
                title="No professionals match these filters"
                description="We are still building the vendor pool for this combination. Submit your requirement anyway — our team sources and verifies vendors for new areas continuously."
                action={<ButtonLink href="/submit-requirement">Submit a requirement</ButtonLink>}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {pros.map((pro) => (
                  <ProfessionalCard key={pro.id} pro={pro} contextDomain={activeDomain?.name} />
                ))}
              </div>
            )}
          </ListingLayout>
        </Container>
      </Section>
    </>
  );
}
