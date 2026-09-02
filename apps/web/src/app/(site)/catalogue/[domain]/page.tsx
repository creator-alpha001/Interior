import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getDomainBySlug,
  listCategories,
  listPackages,
  listPosts,
  listProducts,
  listProfessionals,
} from "@repo/data";
import { PackageCard, PostCard, ProductCard, ProfessionalCard } from "@/components/cards";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Container,
  EmptyState,
  Section,
  SectionHeading,
} from "@repo/ui";
import { getSelectedCity } from "@/lib/city";
import { cn } from "@repo/ui";

type Params = { domain: string };
type Search = { category?: string; sort?: string; q?: string };

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
];

export default async function DomainCataloguePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { domain: slug } = await params;
  const { category, sort, q } = await searchParams;

  const domain = await getDomainBySlug(slug);
  if (!domain) notFound();

  const city = await getSelectedCity();

  const [categories, productPage, packages, proPage, postPage] = await Promise.all([
    listCategories(slug),
    listProducts({
      domainSlug: slug,
      categorySlug: category,
      search: q,
      cityId: city.id,
      sort: (sort as "featured") ?? "featured",
    }),
    listPackages(slug),
    listProfessionals({ domainSlug: slug, cityId: city.id, verifiedOnly: true, limit: 3 }),
    listPosts({ domainSlug: slug, limit: 3 }),
  ]);

  const products = productPage.items;
  const pros = proPage.items;
  const posts = postPage.items;

  const activeCategory = categories.find((c) => c.slug === category);
  const base = `/catalogue/${slug}`;
  const withParam = (key: string, value?: string) => {
    const next = new URLSearchParams();
    if (category && key !== "category") next.set("category", category);
    if (sort && key !== "sort") next.set("sort", sort);
    if (q) next.set("q", q);
    if (value) next.set(key, value);
    const qs = next.toString();
    return qs ? `${base}?${qs}` : base;
  };

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Catalogue", href: "/catalogue" },
              { label: domain.name },
            ]}
          />
          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="max-w-2xl text-[36px] leading-tight sm:text-[42px]">{domain.name}</h1>
              <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
                {domain.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge tone="clay">{domain.labels.pricingBasis}</Badge>
                <Badge>{products.length} items</Badge>
                <Badge>{packages.length} packages</Badge>
                <Badge tone="neutral">Prices for {city.name}</Badge>
              </div>
            </div>
            <ButtonLink href={`/submit-requirement?domain=${domain.slug}`} size="lg">
              Get 3 quotes for {domain.name.toLowerCase()}
            </ButtonLink>
          </div>
        </Container>
      </div>

      <Section tone="paper" className="py-10 sm:py-12">
        <Container width="wide">
          {/* Filters */}
          <div className="flex flex-col gap-4 border-b border-line pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={withParam("category")}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                  !activeCategory
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-2 hover:border-ink-4",
                )}
              >
                All
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={withParam("category", c.slug)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                    activeCategory?.id === c.id
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-ink-2 hover:border-ink-4",
                  )}
                >
                  {c.name}
                </Link>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[14px] sm:text-[13px]">
              <span className="text-ink-4">Sort</span>
              {sorts.map((s) => (
                <Link
                  key={s.key}
                  href={withParam("sort", s.key)}
                  className={cn(
                    "transition-colors",
                    (sort ?? "featured") === s.key
                      ? "font-medium text-brand underline underline-offset-4"
                      : "text-ink-3 hover:text-ink",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </div>
          </div>

          {activeCategory ? (
            <p className="mt-6 text-[15px] sm:text-[14px] text-ink-3">
              <span className="font-medium text-ink">{activeCategory.name}</span> —{" "}
              {activeCategory.description}
            </p>
          ) : null}

          <div className="mt-8">
            {products.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                description="No catalogue items match this filter. Try another category, or tell us what you need and we will find professionals for it."
                action={<ButtonLink href="/submit-requirement">Submit a requirement</ButtonLink>}
              />
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.product.id} view={p} />
                ))}
              </div>
            )}
          </div>
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
            <SectionHeading eyebrow="Guides" title={`Reading before you buy`} />
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
