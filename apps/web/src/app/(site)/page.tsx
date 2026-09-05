import Link from "next/link";
import {
  countCatalogueByDomain,
  getPlatformStats,
  listBanners,
  listDomains,
  listFeaturedPackages,
  listPosts,
  listProducts,
  listProfessionals,
  listTestimonials,
} from "@repo/data";
import { PackageCard, PostCard, ProductCard, ProfessionalCard } from "@/components/cards";
import { getSelectedCity } from "@/lib/city";
import {
  ButtonLink,
  Container,
  Section,
  SectionHeading,
  Stars,
  cn,
} from "@repo/ui";
import { Media } from "@repo/ui";

/** What the platform guarantees, next to the thing that demonstrates it. */
const assurances = [
  "Every professional verified per trade, not in general",
  "Your number is never given to a vendor",
  "One written agreement, tracked to handover",
];

/**
 * The comparison shown in the hero.
 *
 * Deliberately static. Real quotes are private to the customer who asked for
 * them and the vendors who wrote them — they sit behind row-level security for
 * exactly that reason — so putting live figures on a public marketing page
 * would publish a vendor's pricing to their competitors. This is an
 * illustration, and the card says so.
 */
const sampleComparison = {
  scope: "Modular kitchen · up to 90 sq.ft",
  where: "Gomti Nagar, Lucknow",
  turnaround: "3 quotes in 4 days",
  quotes: [
    { vendor: "Rawat Modular", price: "₹2,38,000", timeline: "32 days", warranty: "5 years", chosen: false },
    { vendor: "Casa Nidhi Studio", price: "₹2,45,000", timeline: "28 days", warranty: "7 years", chosen: true },
    { vendor: "Nook & Grain", price: "₹2,71,000", timeline: "24 days", warranty: "5 years", chosen: false },
  ],
};

const steps = [
  {
    title: "Tell us what you need",
    body: "One short form. Pick one service or several — a single dining table and a full home renovation take the same two minutes.",
  },
  {
    title: "We assign three professionals",
    body: "Verified vendors for each service you selected, in your city. We speak to them before assigning, so everyone you meet is available.",
  },
  {
    title: "They visit and quote",
    body: "Each one measures the job properly on site, then uploads a written quote with a timeline, warranty and material details.",
  },
  {
    title: "Compare, side by side",
    body: "One table per service. Price, timeline, warranty, materials, rating. No sales pressure while you decide.",
  },
  {
    title: "Sign and track",
    body: "A written agreement per professional, then day-by-day progress until handover. Rate each job when it is done.",
  },
];

export default async function HomePage() {
  const city = await getSelectedCity();
  const [
    domains,
    banners,
    counts,
    featuredPackages,
    productPage,
    proPage,
    testimonials,
    postPage,
    stats,
  ] = await Promise.all([
      listDomains(),
      listBanners(),
      countCatalogueByDomain(),
      listFeaturedPackages(4),
      listProducts({ sort: "featured", limit: 8, cityId: city.id }),
      listProfessionals({ verifiedOnly: true, limit: 3, cityId: city.id }),
      listTestimonials(),
      listPosts({ limit: 3 }),
      getPlatformStats(),
    ]);

  const featuredProducts = productPage.items;
  const pros = proPage.items;
  const posts = postPage.items;

  const countFor = (domainId: string) => counts.find((c) => c.domainId === domainId);
  const hero = banners[0];

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      {/*
        The comparison is the opening image.

        Three written quotes against one scope is the thing the platform does
        that a directory or a contact form cannot, and it is far easier to show
        than to describe. It also holds the page on its own, which the previous
        collage could not: those four tiles are placeholders until photography
        exists, and a hero built out of them is a hero built out of an absence.
      */}
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <Container width="wide" className="py-14 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[0.86fr_1.14fr]">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.15em] text-clay sm:text-[11px]">
                Free · no obligation
              </p>

              <h1 className="mt-5 text-[40px] leading-[1.02] sm:text-[56px]">
                Three quotes.
                <br />
                One table.
                <br />
                <span className="text-brand">No sales calls.</span>
              </h1>

              <p className="mt-5 max-w-md text-[16px] leading-relaxed text-ink-2">
                Interiors, furniture, fabrication and painting. Every quote is written against the
                same scope — so the numbers actually mean the same thing.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <ButtonLink href="/submit-requirement" size="lg" className="w-full sm:w-auto">
                  Get free quotes
                </ButtonLink>
                <ButtonLink
                  href="/catalogue"
                  size="lg"
                  variant="secondary"
                  className="w-full sm:w-auto"
                >
                  Browse the catalogue
                </ButtonLink>
              </div>

              <ul className="mt-9 flex flex-col gap-2.5 border-t border-line pt-7">
                {assurances.map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[14.5px] text-ink-2 sm:text-[13.5px]">
                    <svg
                      viewBox="0 0 16 16"
                      className="mt-[3px] h-3.5 w-3.5 shrink-0 fill-brand"
                      aria-hidden="true"
                    >
                      <path d="M6.5 11.4L3.3 8.2l1-1 2.2 2.2 5-5 1 1-6 6z" />
                    </svg>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lift)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <p className="text-[15px] font-semibold text-ink sm:text-[14.5px]">
                    {sampleComparison.scope}
                  </p>
                  <p className="text-[13px] text-ink-3 sm:text-[12.5px]">{sampleComparison.where}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-medium text-brand sm:text-[12px]">
                  {sampleComparison.turnaround}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left">
                  <thead>
                    <tr className="bg-surface-2">
                      {["Professional", "Quote", "Timeline", "Warranty"].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.11em] text-ink-4 sm:text-[10.5px]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sampleComparison.quotes.map((q) => (
                      <tr
                        key={q.vendor}
                        className={cn(
                          "border-t border-line",
                          q.chosen ? "bg-brand-soft" : undefined,
                        )}
                      >
                        <td
                          className={cn(
                            "px-5 py-3.5 text-[14.5px] font-medium sm:text-[14px]",
                            q.chosen ? "text-brand" : "text-ink",
                          )}
                        >
                          {q.vendor}
                          <span
                            className={cn("ml-1.5 text-[12px]", q.chosen ? "text-brand" : "text-positive")}
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-[14.5px] tabular-nums sm:text-[14px]",
                            q.chosen ? "font-semibold text-brand" : "text-ink-2",
                          )}
                        >
                          {q.price}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-[14.5px] sm:text-[14px]",
                            q.chosen ? "text-brand" : "text-ink-2",
                          )}
                        >
                          {q.timeline}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-[14.5px] sm:text-[14px]",
                            q.chosen ? "text-brand" : "text-ink-2",
                          )}
                        >
                          {q.warranty}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-2 px-5 py-3">
                <p className="text-[13px] text-ink-3 sm:text-[12.5px]">
                  Same scope. Same materials list. Compare the number, not the pitch.
                </p>
                {/* Real quotes belong to the customer and the vendors who wrote
                    them, so this is an illustration and says so. */}
                <p className="text-[12.5px] text-ink-4 sm:text-[12px]">Illustrative quotes</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ---------------- Proof strip ---------------- */}
      {/*
        Figures that are true at this size. The previous strip divided the
        project count by a thousand, so a real early number printed as "0.0K+",
        and averaged a rating across two reviews as though it meant something.
      */}
      <section className="border-b border-line bg-surface">
        <Container width="wide" className="px-0">
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {[
              { value: String(stats.cities), label: "Cities live today" },
              { value: String(stats.professionals), label: "Verified professionals" },
              { value: "3", label: "Quotes per service, always" },
              { value: "₹0", label: "Cost to get quotes" },
            ].map((item, i) => (
              <div
                key={item.label}
                className={cn(
                  "flex flex-col gap-1 px-6 py-7 sm:px-8",
                  i < 3 && "lg:border-r lg:border-line",
                  i % 2 === 0 && "border-r border-line lg:border-r",
                  i < 2 && "border-b border-line lg:border-b-0",
                )}
              >
                <dt className="order-2 text-[13.5px] text-ink-3 sm:text-[13px]">{item.label}</dt>
                <dd className="order-1 font-display text-[30px] leading-none tabular-nums text-ink sm:text-[34px]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ---------------- Domains ---------------- */}
      <Section tone="surface">
        <Container width="wide">
          <SectionHeading
            eyebrow="What we cover"
            title="Four services, one platform"
            description="Every professional on Aangan is approved per trade, not in general — so a fabricator only receives fabrication leads unless they are separately approved for painting."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {domains.map((domain) => {
              const count = countFor(domain.id);
              return (
                <Link
                  key={domain.id}
                  href={`/catalogue/${domain.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    <Media
                      src={`ph:${domain.slug.replace("interior-design", "interior")}:domain-${domain.slug}`}
                      alt={domain.name}
                      label={domain.name}
                      rounded={false}
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-[21px] text-ink transition-colors group-hover:text-brand">
                      {domain.name}
                    </h3>
                    <p className="mt-2 flex-1 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">
                      {domain.tagline}
                    </p>
                    <p className="mt-4 text-[13.5px] sm:text-[12.5px] text-ink-4">
                      {count?.products ?? 0} items · {count?.packages ?? 0} packages
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* ---------------- Packages ---------------- */}
      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Ready-made packages"
            title="Priced scopes, nothing hidden"
            description="Each package lists exactly what is included and — more importantly — what is not. Pick one and three professionals will quote against that exact scope."
            action={
              <ButtonLink href="/packages" variant="secondary" size="sm">
                All packages
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredPackages.map((pkg) => (
              <PackageCard key={pkg.servicePackage.id} view={pkg} />
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- How it works ---------------- */}
      <Section tone="brand">
        <Container width="wide">
          <SectionHeading
            eyebrow="How it works"
            title="From enquiry to handover"
            description="The same five steps whether you want one wardrobe or a full renovation across three trades."
            invert
          />
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <li key={step.title} className="border-t border-white/20 pt-5">
                <span className="font-display text-[30px] leading-none text-white/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-sans text-[15px] font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-white/70">{step.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <ButtonLink href="/submit-requirement" variant="onDark">
              Start with a free consultation
            </ButtonLink>
          </div>
        </Container>
      </Section>

      {/* ---------------- Products ---------------- */}
      <Section tone="surface">
        <Container width="wide">
          <SectionHeading
            eyebrow="Browse the catalogue"
            title="Pick what you like. We make it to your size."
            description="Nothing here is off-the-shelf stock. Choose an item, tell us your measurements, and the vendor builds that exact piece for your home."
            action={
              <ButtonLink href="/catalogue" variant="secondary" size="sm">
                Full catalogue
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((p) => (
              <ProductCard key={p.product.id} view={p} />
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- Professionals ---------------- */}
      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="The people who do the work"
            title="Verified, rated per trade"
            description="A vendor who is excellent at painting and average at carpentry shows exactly that. Ratings are held per domain, not averaged into one flattering number."
            action={
              <ButtonLink href="/professionals" variant="secondary" size="sm">
                Browse professionals
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pros.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} />
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- Testimonials ---------------- */}
      <Section tone="sand">
        <Container width="wide">
          <SectionHeading eyebrow="Customers" title="What people say" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {testimonials.map((t) => (
              <figure
                key={t.id}
                className="flex flex-col rounded-xl border border-line bg-surface p-5"
              >
                <Stars value={t.rating} />
                <blockquote className="mt-3 flex-1 text-[15px] sm:text-[14px] leading-relaxed text-ink-2">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-4 border-t border-line pt-3 text-[13.5px] sm:text-[12.5px] text-ink-4">
                  <span className="font-medium text-ink-2">{t.clientName}</span> · {t.cityName}
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- Blog ---------------- */}
      <Section tone="surface">
        <Container width="wide">
          <SectionHeading
            eyebrow="Guides"
            title="Know what you are buying"
            description="Written by the professionals on the platform. What things cost, which materials are worth paying for, and where quotes hide the difference."
            action={
              <ButtonLink href="/blog" variant="secondary" size="sm">
                Read the blog
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.post.id} view={p} />
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- Closing CTA ---------------- */}
      {hero ? (
        <section className="border-t border-line bg-paper">
          <Container width="wide" className="py-16">
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="grid items-center gap-0 md:grid-cols-2">
                <div className="p-8 sm:p-12">
                  <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
                    {hero.title}
                  </p>
                  <h2 className="mt-3 text-[30px] leading-tight sm:text-[36px]">
                    {hero.subtitle}
                  </h2>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <ButtonLink href={hero.ctaHref}>{hero.ctaLabel}</ButtonLink>
                    <ButtonLink href="/submit-requirement" variant="secondary">
                      Get free quotes
                    </ButtonLink>
                  </div>
                </div>
                <div className="aspect-[16/10] md:aspect-auto md:h-full md:min-h-[320px]">
                  <Media src={hero.imageUrl} alt={hero.title} rounded={false} />
                </div>
              </div>
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
