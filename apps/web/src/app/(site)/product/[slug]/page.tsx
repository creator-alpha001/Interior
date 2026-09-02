import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProductBySlug,
  listProfessionals,
  listRelatedProducts,
  priceUnitLabel,
} from "@repo/data";
import { ProductCard, ProfessionalCard } from "@/components/cards";
import { MobileActionBar } from "@/components/catalogue/mobile-action-bar";
import { ProductConfigurator } from "@/components/catalogue/product-configurator";
import { getSelectedCity } from "@/lib/city";
import {
  Badge,
  Breadcrumbs,
  Container,
  RatingLine,
  Section,
  SectionHeading,
} from "@repo/ui";
import { Media } from "@repo/ui";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getProductBySlug(slug);
  if (!view) return { title: "Not found" };
  return {
    title: view.product.name,
    description: view.product.shortDescription,
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const city = await getSelectedCity();
  const view = await getProductBySlug(slug, city.id);
  if (!view) notFound();

  const { product, domain, category } = view;
  const [related, proPage] = await Promise.all([
    listRelatedProducts(product.id, city.id, 4),
    listProfessionals({ domainSlug: domain.slug, cityId: city.id, verifiedOnly: true, limit: 3 }),
  ]);

  const pros = proPage.items;

  return (
    <>
      <Container width="wide" className="py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Catalogue", href: "/catalogue" },
            { label: domain.name, href: `/catalogue/${domain.slug}` },
            { label: category.name, href: `/catalogue/${domain.slug}?category=${category.slug}` },
            { label: product.name },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Gallery */}
          <div>
            <div className="aspect-[4/3] overflow-hidden rounded-xl">
              <Media src={product.media[0]?.url ?? "ph:default:x"} alt={product.name} rounded={false} />
            </div>
            {/* A scrollable strip on phones, a tidy grid once there is room. */}
            <div className="no-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
              {product.media.slice(1).map((m) => (
                <div
                  key={m.id}
                  className="aspect-[4/3] w-32 shrink-0 overflow-hidden rounded-lg sm:w-auto"
                >
                  <Media src={m.url} alt={product.name} rounded={false} />
                </div>
              ))}
            </div>
          </div>

          {/* Summary + configurator */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{domain.name}</Badge>
              <Badge>{category.name}</Badge>
              {product.tags.map((t) => (
                <Badge key={t} tone={t === "bestseller" ? "clay" : "neutral"}>
                  {t}
                </Badge>
              ))}
            </div>

            <h1 className="mt-4 text-[32px] leading-tight sm:text-[38px]">{product.name}</h1>
            <div className="mt-3 flex items-center gap-3">
              <RatingLine value={product.rating} count={product.ratingCount} />
              <span className="text-[14px] sm:text-[13px] text-ink-4">·</span>
              <span className="text-[14px] sm:text-[13px] text-ink-3">
                Priced {priceUnitLabel[product.priceUnit]} · rates for {city.name}
              </span>
            </div>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
              {product.shortDescription}
            </p>

            <div className="mt-6">
              <ProductConfigurator view={view} />
            </div>
          </div>
        </div>
      </Container>

      <Section tone="surface">
        <Container width="wide">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h2 className="text-[26px]">About this item</h2>
              <div className="prose-article mt-5">
                <p>{product.description}</p>
              </div>

              <h3 className="mt-10 font-display text-[21px]">How pricing works for this</h3>
              <p className="mt-3 text-[15.5px] sm:text-[14.5px] leading-relaxed text-ink-2">
                {domain.labels.pricingBasis}. The figure shown is an indicative starting rate for{" "}
                {product.name.toLowerCase()}. Your final price depends on measurements taken on
                site, the finish you choose, and whether you or the vendor supplies the material —
                which is why every requirement goes out to three professionals rather than being
                quoted from a price list.
              </p>
            </div>

            <div>
              <div className="rounded-xl border border-line bg-paper p-6">
                <h3 className="font-sans text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                  Specifications
                </h3>
                <dl className="mt-4">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-baseline justify-between gap-6 border-b border-line py-3 last:border-0"
                    >
                      <dt className="text-[14px] sm:text-[13px] text-ink-3">{key}</dt>
                      <dd className="text-right text-[14.5px] sm:text-[13.5px] font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-6 border-t border-line py-3">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Typical lead time</dt>
                    <dd className="text-right text-[14.5px] sm:text-[13.5px] font-medium text-ink">
                      {product.leadTimeDays} days
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-6 py-3">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Made to your size</dt>
                    <dd className="text-right text-[14.5px] sm:text-[13.5px] font-medium text-ink">
                      {product.isCustomisable ? "Yes" : "Standard sizes only"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Who will build it"
            title={`${domain.name} professionals near you`}
            description="You will be assigned three from this pool, all of whom we have spoken to and confirmed as available before assignment."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pros.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} contextDomain={domain.name} />
            ))}
          </div>
        </Container>
      </Section>

      <MobileActionBar
        price={view.effectivePrice}
        priceLabel={`${priceUnitLabel[product.priceUnit]} · from`}
        href={`/submit-requirement?product=${product.slug}`}
        cta="Get 3 quotes"
        note="Free · made to your measurements"
      />

      {related.length > 0 ? (
        <Section tone="surface">
          <Container width="wide">
            <SectionHeading eyebrow="Also consider" title="Related items" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <ProductCard key={p.product.id} view={p} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
