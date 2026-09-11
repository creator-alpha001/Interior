import type { Metadata } from "next";
import Link from "next/link";
import { domainById, listCities, listDomains, listPortfolio, listProfessionals } from "@repo/data";
import type { ProfessionalSummary } from "@repo/types";
import { FilterForm, SortSelect } from "@/components/listing/filter-form";
import {
  ActiveFilters,
  Choice,
  FilterSection,
  ListingLayout,
} from "@/components/listing/filter-parts";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Container,
  EmptyState,
  Media,
  Section,
} from "@repo/ui";
import { hrefWith, toRating } from "@/lib/filters";

export const metadata: Metadata = {
  title: "Our work",
  description:
    "Completed interiors, furniture, fabrication and painting projects by verified professionals — filter by trade, city and rating to find work like yours.",
};

type Search = { domain?: string; city?: string; rating?: string; sort?: string };

const sorts = [
  { key: "recommended", label: "Recommended" },
  { key: "rating", label: "Top-rated professionals" },
  { key: "projects", label: "Most experienced teams" },
] as const;

const ratings = [
  { value: "4.5", label: "4.5 ★ and above" },
  { value: "4", label: "4 ★ and above" },
];

export default async function OurWorkPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const search = await searchParams;
  const { domain: domainSlug, city: cityId } = search;
  const sort = sorts.find((s) => s.key === search.sort)?.key ?? "recommended";
  const minRating = toRating(search.rating);

  const [domains, cities, allItems] = await Promise.all([
    listDomains(),
    listCities(),
    listPortfolio(domainSlug),
  ]);

  // Portfolio entries carry a professional id, so each piece of work links back
  // to the person who actually did it rather than floating free.
  //
  // Paged rather than fetched in one go. This asked for `limit: 200` against a
  // contract that caps the page at 100, so the API answered 422 and the whole
  // page rendered "Something went wrong at our end" — a 500 on a public
  // marketing surface, caused by a number nobody had checked against the
  // schema. Paging is also the only version that stays correct: a single
  // over-large fetch would silently lose attributions the day the pool passes
  // whatever cap was hardcoded.
  const pros: ProfessionalSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await listProfessionals({ limit: 100, cursor });
    pros.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  const proById = new Map(pros.map((p) => [p.id, p]));

  // City and rating belong to the professional rather than the piece of work,
  // so they are applied here, against the directory the page already holds.
  const items = allItems
    .filter((item) => {
      const pro = proById.get(item.professionalId);
      if (cityId && pro?.city?.id !== cityId) return false;
      if (minRating && (pro?.avgRating ?? 0) < minRating) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "recommended") return 0;
      const pa = proById.get(a.professionalId);
      const pb = proById.get(b.professionalId);
      return sort === "rating"
        ? (pb?.avgRating ?? 0) - (pa?.avgRating ?? 0)
        : (pb?.completedProjects ?? 0) - (pa?.completedProjects ?? 0);
    });

  const activeDomain = domains.find((d) => d.slug === domainSlug);
  const activeCity = cities.find((c) => c.id === cityId);

  const base = "/our-work";
  const current: Record<string, string | undefined> = {
    domain: domainSlug,
    city: cityId,
    rating: search.rating,
    sort: search.sort,
  };

  const chips = [
    activeDomain && { label: activeDomain.name, href: hrefWith(base, current, { domain: undefined }) },
    activeCity && { label: activeCity.name, href: hrefWith(base, current, { city: undefined }) },
    minRating && { label: `${minRating} ★ and above`, href: hrefWith(base, current, { rating: undefined }) },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));

  const filters = (
    <FilterForm key={JSON.stringify(current)} keep={{ sort: search.sort }}>
      <FilterSection title="Trade">
        <Choice name="domain" value="" checked={!activeDomain} label="All trades" />
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

      <FilterSection title="Professional's rating">
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
    </FilterForm>
  );

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-8 sm:py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Our work" }]} />
          <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,460px)]">
            <div>
              <h1 className="max-w-3xl text-[32px] leading-tight sm:text-[40px]">
                Designs delivered in real homes
              </h1>
              <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
                Every project here was completed by a professional on the platform, and every photo
                is moderated before it appears. Find work like the home you have in mind, then ask
                the people who did it to quote for yours.
              </p>
              <ButtonLink href="/submit-requirement" size="lg" className="mt-6">
                Get free design quotes
              </ButtonLink>
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-line lg:block">
              <Media
                src="/images/stock/hero/2.jpg"
                alt="A finished living room"
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
                  <span className="font-semibold text-ink">{items.length}</span>{" "}
                  {items.length === 1 ? "project" : "projects"}
                </p>
                <SortSelect options={[...sorts]} value={sort} params={current} />
              </div>
            }
          >
            <ActiveFilters chips={chips} clearHref={base} />

            {items.length === 0 ? (
              <EmptyState
                title="No work published for these filters yet"
                description="We are still building the portfolio here. In the meantime, tell us what you need and we will put three professionals in front of you."
                action={<ButtonLink href="/submit-requirement">Get free quotes</ButtonLink>}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const pro = proById.get(item.professionalId);
                  const domain = domainById(item.domainId);
                  return (
                    <figure
                      key={item.id}
                      className="group overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-[var(--shadow-lift)]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <div className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]">
                          <Media
                            src={item.media[0]?.url ?? `ph:${domain.slug}:${item.id}`}
                            alt={item.title}
                            rounded={false}
                          />
                        </div>
                        {item.media.length > 1 ? (
                          <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
                            {item.media.length} photos
                          </span>
                        ) : null}
                      </div>
                      <figcaption className="p-5">
                        <Badge tone="neutral">{domain.name}</Badge>
                        <h2 className="mt-2.5 text-[17px] leading-tight text-ink">{item.title}</h2>
                        <p className="mt-2 line-clamp-3 text-[14.5px] leading-relaxed text-ink-3 sm:text-[13.5px]">
                          {item.description}
                        </p>
                        {pro ? (
                          <Link
                            href={`/professionals/${pro.id}`}
                            className="mt-4 flex items-center gap-2.5 border-t border-line pt-3.5 text-[14px] text-ink-2 transition-colors hover:text-brand sm:text-[13px]"
                          >
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-[13px] font-medium text-brand sm:text-[12px]">
                              {pro.name.charAt(0)}
                            </span>
                            <span className="truncate">{pro.companyName}</span>
                            {pro.city ? (
                              <span className="ml-auto shrink-0 text-[13px] text-ink-4 sm:text-[12px]">
                                {pro.city.name}
                              </span>
                            ) : null}
                          </Link>
                        ) : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </ListingLayout>
        </Container>
      </Section>

      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/stock/hero/3.jpg"
          alt=""
          loading="lazy"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/55" />
        <Container width="default" className="py-16 text-center sm:py-20">
          <h2 className="text-[28px] text-white sm:text-[34px]">Want something like this?</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/80">
            Tell us what you have in mind. Three professionals will visit, measure and quote — free,
            and with no obligation.
          </p>
          <div className="mt-8">
            <ButtonLink href="/submit-requirement" variant="onDark" size="lg">
              Get free design quotes
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
