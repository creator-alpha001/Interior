import type { Metadata } from "next";
import Link from "next/link";
import { search } from "@repo/data";
import { PackageCard, PostCard, ProductCard, ProfessionalCard } from "@/components/cards";
import { SearchField } from "@/components/site/search-field";
import {
  Breadcrumbs,
  ButtonLink,
  Container,
  EmptyState,
  Section,
} from "@repo/ui";
import { getSelectedCity } from "@/lib/city";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const city = await getSelectedCity();
  const results = await search(q, city.id);

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Search" }]} />
          <h1 className="mt-4 text-[32px] leading-tight sm:text-[38px]">
            {q ? <>Results for “{q}”</> : "Search"}
          </h1>
          {q ? (
            <p className="mt-3 text-[15.5px] sm:text-[14.5px] text-ink-3">
              {results.total} {results.total === 1 ? "result" : "results"} · prices shown for{" "}
              {city.name}
            </p>
          ) : null}
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          {!q ? (
            <EmptyState
              title="What are you looking for?"
              description="Search the catalogue, packages, professionals and guides — try “wardrobe”, “waterproofing” or “gate”."
            />
          ) : results.total === 0 ? (
            <EmptyState
              title={`Nothing matched “${q}”`}
              description="We may still be able to help — most work is made to order, and the catalogue is only a starting point. Tell us what you need and professionals will quote for it."
              action={<ButtonLink href="/submit-requirement">Submit a requirement</ButtonLink>}
            />
          ) : (
            <div className="space-y-12">
              {results.products.length > 0 ? (
                <section>
                  <h2 className="mb-5 text-[22px]">Catalogue items</h2>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {results.products.map((p) => (
                      <ProductCard key={p.product.id} view={p} />
                    ))}
                  </div>
                </section>
              ) : null}

              {results.packages.length > 0 ? (
                <section>
                  <h2 className="mb-5 text-[22px]">Packages</h2>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {results.packages.map((p) => (
                      <PackageCard key={p.servicePackage.id} view={p} />
                    ))}
                  </div>
                </section>
              ) : null}

              {results.professionals.length > 0 ? (
                <section>
                  <h2 className="mb-5 text-[22px]">Professionals</h2>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {results.professionals.map((pro) => (
                      <ProfessionalCard key={pro.id} pro={pro} />
                    ))}
                  </div>
                </section>
              ) : null}

              {results.posts.length > 0 ? (
                <section>
                  <div className="mb-5 flex items-baseline justify-between">
                    <h2 className="text-[22px]">Guides</h2>
                    <Link href="/blog" className="text-[14.5px] sm:text-[13.5px] font-medium text-brand">
                      All guides →
                    </Link>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {results.posts.map((p) => (
                      <PostCard key={p.post.id} view={p} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
