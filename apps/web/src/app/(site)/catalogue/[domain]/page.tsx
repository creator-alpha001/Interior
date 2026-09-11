import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  formatRupeesShort,
  getDomainBySlug,
  listCategories,
  listPackages,
  listPosts,
  listProducts,
  listProfessionals,
} from "@repo/data";
import { PackageCard, PostCard, ProductCard, ProfessionalCard } from "@/components/cards";
import { FilterForm, SortSelect } from "@/components/listing/filter-form";
import {
  ActiveFilters,
  Choice,
  FilterSection,
  ListingLayout,
  PriceInputs,
} from "@/components/listing/filter-parts";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Container,
  EmptyState,
  Media,
  Section,
  SectionHeading,
} from "@repo/ui";
import { getSelectedCity } from "@/lib/city";
import { hrefWith, parsePriceKey, priceBuckets, toRating, toWhole } from "@/lib/filters";

type Params = { domain: string };
type Search = {
  category?: string;
  sort?: string;
  q?: string;
  price?: string;
  minPrice?: string;
  maxPrice?: string;
  rating?: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { domain: slug } = await params;
  const domain = await getDomainBySlug(slug);
  if (!domain) return { title: "Not found" };
  return {
    title: domain.name,
    description: domain.description,
  };
}

const sorts = [
  { key: "featured", label: "Featured" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "rating", label: "Top rated" },
] as const;

const ratings = [
  { value: "4.5", label: "4.5 ★ and above" },
  { value: "4", label: "4 ★ and above" },
  { value: "3", label: "3 ★ and above" },
];

export default async function DomainCataloguePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { domain: slug } = await params;
  const search = await searchParams;
  const { category, q, price } = search;

  const domain = await getDomainBySlug(slug);
  if (!domain) notFound();

  const city = await getSelectedCity();

  const sort = sorts.find((s) => s.key === search.sort)?.key ?? "featured";
  const typedMin = toWhole(search.minPrice);
  const typedMax = toWhole(search.maxPrice);
  const typedBounds = typedMin !== undefined || typedMax !== undefined;
  // Typed bounds win over a band: typing is the more specific answer, and the
  // form clears the band when bounds are applied anyway.
  const bounds = typedBounds ? { min: typedMin, max: typedMax || undefined } : parsePriceKey(price);
  const minRating = toRating(search.rating);

  const [categories, productPage, pricePool, packages, proPage, postPage] = await Promise.all([
    listCategories(slug),
    listProducts({
      domainSlug: slug,
      categorySlug: category,
      search: q,
      cityId: city?.id,
      sort,
      minPrice: bounds.min,
      maxPrice: bounds.max,
      minRating,
      limit: 48,
    }),
    // The trade's whole price range, unfiltered, to draw the bands from. Bands
    // drawn from the filtered page would shrink every time one was picked.
    listProducts({ domainSlug: slug, cityId: city?.id, limit: 48 }),
    listPackages(slug),
    listProfessionals({ domainSlug: slug, cityId: city?.id, limit: 3 }),
    listPosts({ domainSlug: slug, limit: 3 }),
  ]);

  const products = productPage.items;
  const pros = proPage.items;
  const posts = postPage.items;
  const buckets = priceBuckets(
    pricePool.items.map((p) => p.effectivePrice),
    formatRupeesShort,
  );

  const activeCategory = categories.find((c) => c.slug === category);
  const activeBucket = typedBounds ? undefined : buckets.find((b) => b.key === price);
  const base = `/catalogue/${slug}`;
  const current: Record<string, string | undefined> = {
    category,
    q,
    sort: search.sort,
    price: typedBounds ? undefined : price,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    rating: search.rating,
  };

  const chips = [
    activeCategory && {
      label: activeCategory.name,
      href: hrefWith(base, current, { category: undefined }),
    },
    activeBucket && { label: activeBucket.label, href: hrefWith(base, current, { price: undefined }) },
    typedBounds && {
      label: `${typedMin !== undefined ? formatRupeesShort(typedMin) : "Any"} – ${
        typedMax ? formatRupeesShort(typedMax) : "Any"
      }`,
      href: hrefWith(base, current, { minPrice: undefined, maxPrice: undefined }),
    },
    minRating && {
      label: `${minRating} ★ and above`,
      href: hrefWith(base, current, { rating: undefined }),
    },
    q && { label: `“${q}”`, href: hrefWith(base, current, { q: undefined }) },
  ].filter((chip): chip is { label: string; href: string } => Boolean(chip));

  const filters = (
    // Keyed on the query, so a chip removed or "Clear all" resets the inputs
    // rather than leaving them showing a filter that is no longer applied.
    <FilterForm key={JSON.stringify(current)} keep={{ q, sort: search.sort }}>
      <FilterSection title="Category">
        <Choice name="category" value="" checked={!activeCategory} label="All categories" />
        {categories.map((c) => (
          <Choice
            key={c.id}
            name="category"
            value={c.slug}
            checked={activeCategory?.id === c.id}
            label={c.name}
          />
        ))}
      </FilterSection>

      <FilterSection title={`Price${city ? ` in ${city.name}` : ""}`}>
        <Choice
          name="price"
          value=""
          checked={!activeBucket}
          label="Any price"
          clears="minPrice,maxPrice"
        />
        {buckets.map((b) => (
          <Choice
            key={b.key}
            name="price"
            value={b.key}
            checked={activeBucket?.key === b.key}
            label={b.label}
            clears="minPrice,maxPrice"
          />
        ))}
        <PriceInputs min={typedMin} max={typedMax} />
      </FilterSection>

      <FilterSection title="Customer rating">
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
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Catalogue", href: "/catalogue" },
              { label: domain.name },
            ]}
          />
          <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,460px)]">
            <div>
              <h1 className="max-w-2xl text-[32px] leading-tight sm:text-[40px]">{domain.name}</h1>
              <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
                {domain.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge tone="clay">{domain.labels.pricingBasis}</Badge>
                <Badge>{packages.length} packages</Badge>
                {/* Naming the city is the point of the badge, so with no city
                    chosen it says that rather than a city nobody picked. */}
                <Badge tone="neutral">
                  {city ? `Prices for ${city.name}` : "Prices across every city"}
                </Badge>
              </div>
              <ButtonLink href={`/submit-requirement?domain=${domain.slug}`} size="lg" className="mt-6">
                Get 3 quotes for {domain.name.toLowerCase()}
              </ButtonLink>
            </div>
            {/* The trade's own banner when ops have set one, else a photograph
                from the trade, so the header is never an empty band. */}
            <div className="hidden overflow-hidden rounded-xl border border-line lg:block">
              <Media
                src={domain.bannerUrl ?? `ph:${domain.slug}:banner-${domain.id}`}
                alt={domain.name}
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
                  <span className="font-semibold text-ink">{products.length}</span>{" "}
                  {products.length === 1 ? "item" : "items"}
                  {activeCategory ? ` in ${activeCategory.name}` : ""}
                </p>
                <SortSelect options={[...sorts]} value={sort} params={current} />
              </div>
            }
          >
            <ActiveFilters chips={chips} clearHref={base} />

            {activeCategory?.description ? (
              <p className="mb-5 text-[15px] text-ink-3 sm:text-[14px]">
                <span className="font-medium text-ink">{activeCategory.name}</span> —{" "}
                {activeCategory.description}
              </p>
            ) : null}

            {products.length === 0 ? (
              <EmptyState
                title="Nothing matches these filters"
                description="Try widening the price range or clearing a filter — or tell us what you need and we will find professionals for it."
                action={<ButtonLink href="/submit-requirement">Submit a requirement</ButtonLink>}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p) => (
                  <ProductCard key={p.product.id} view={p} />
                ))}
              </div>
            )}
          </ListingLayout>
        </Container>
      </Section>

      {packages.length > 0 ? (
        <Section tone="surface">
          <Container width="wide">
            <SectionHeading
              eyebrow="Packages"
              title={`${domain.name} packages`}
              description="A fixed scope at a fixed indicative price, with inclusions and exclusions written down."
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {packages.slice(0, 4).map((pkg) => (
                <PackageCard key={pkg.servicePackage.id} view={pkg} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}

      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Who does the work"
            title={`Top-rated for ${domain.name.toLowerCase()}`}
            description={`Ratings shown are for ${domain.name.toLowerCase()} specifically — not a blended average across every trade a vendor happens to offer.`}
            action={
              <ButtonLink href={`/professionals?domain=${domain.slug}`} variant="secondary" size="sm">
                See all
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pros.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} contextDomain={domain.name} />
            ))}
          </div>
        </Container>
      </Section>

      {posts.length > 0 ? (
        <Section tone="surface">
          <Container width="wide">
            <SectionHeading eyebrow="Guides" title="Reading before you buy" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <PostCard key={p.post.id} view={p} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
