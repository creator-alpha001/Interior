import type { Metadata } from "next";
import Link from "next/link";
import {
  countCatalogueByDomain,
  listCategories,
  listDomains,
  listFeaturedPackages,
  listProducts,
} from "@repo/data";
import { PackageCard, ProductCard } from "@/components/cards";
import {
  Breadcrumbs,
  ButtonLink,
  Container,
  Section,
  SectionHeading,
} from "@repo/ui";
import { Media } from "@repo/ui";

export const metadata: Metadata = {
  title: "Catalogue",
  description:
    "Browse furniture, interiors, fabrication and painting. Every item is made to your measurements — pick what you like and three professionals will quote for it.",
};

export default async function CataloguePage() {
  const [domains, counts, packages, bestsellers] = await Promise.all([
    listDomains(),
    countCatalogueByDomain(),
    listFeaturedPackages(4),
    listProducts({ tags: ["bestseller"], limit: 8 }),
  ]);

  const categoriesByDomain = await Promise.all(
    domains.map(async (d) => ({ domain: d, categories: await listCategories(d.slug) })),
  );

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Catalogue" }]} />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[44px]">
            Everything we build, in one catalogue
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            Nothing here is stock. Prices are indicative starting rates — pick an item, tell us your
            measurements, and three verified professionals quote for that exact piece.
          </p>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <div className="grid gap-6 lg:grid-cols-2">
            {categoriesByDomain.map(({ domain, categories }) => {
              const count = counts.find((c) => c.domainId === domain.id);
              return (
                <div
                  key={domain.id}
                  className="overflow-hidden rounded-xl border border-line bg-surface"
                >
                  <div className="grid sm:grid-cols-[180px_1fr]">
                    <div className="aspect-[16/10] sm:aspect-auto">
                      <Media
                        src={`ph:${domain.slug.replace("interior-design", "interior")}:cat-${domain.slug}`}
                        alt={domain.name}
                        rounded={false}
                      />
                    </div>
                    <div className="p-5">
                      <h2 className="font-display text-[23px] text-ink">{domain.name}</h2>
                      <p className="mt-1.5 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
                        {domain.tagline}
                      </p>
                      <p className="mt-3 text-[13.5px] sm:text-[12.5px] text-ink-4">
                        {count?.products ?? 0} items · {count?.packages ?? 0} packages ·{" "}
                        {domain.labels.pricingBasis}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {categories.map((c) => (
                          <Link
                            key={c.id}
                            href={`/catalogue/${domain.slug}?category=${c.slug}`}
                            className="rounded-full border border-line bg-paper px-2.5 py-1 text-[13.5px] sm:text-[12.5px] text-ink-2 transition-colors hover:border-brand-line hover:bg-brand-soft hover:text-brand"
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>

                      <ButtonLink
                        href={`/catalogue/${domain.slug}`}
                        variant="secondary"
                        size="sm"
                        className="mt-5"
                      >
                        Browse {domain.name}
                      </ButtonLink>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container width="wide">
          <SectionHeading
            eyebrow="Most requested"
            title="Bestsellers across every trade"
            action={
              <ButtonLink href="/packages" variant="secondary" size="sm">
                See packages
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {bestsellers.map((p) => (
              <ProductCard key={p.product.id} view={p} />
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Bundles"
            title="Packages with a fixed scope"
            description="Where a single item is not the whole job, a package covers the scope end to end — with the exclusions written down, not implied."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {packages.map((pkg) => (
              <PackageCard key={pkg.servicePackage.id} view={pkg} />
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
