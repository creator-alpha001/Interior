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
  Stat,
} from "@repo/ui";
import { Media } from "@repo/ui";

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
  const [domains, banners, counts, featuredPackages, featuredProducts, pros, testimonials, posts, stats] =
    await Promise.all([
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

  const countFor = (domainId: string) => counts.find((c) => c.domainId === domainId);
  const hero = banners[0];

  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden border-b border-line bg-paper">
        <Container width="wide" className="py-14 sm:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13.5px] sm:text-[12.5px] text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                Now serving {stats.cities} cities · {stats.professionals} verified professionals
              </div>

              <h1 className="mt-6 text-[40px] leading-[1.06] sm:text-[56px]">
                Four trades, three quotes,
                <br />
                <span className="text-brand">one decision.</span>
              </h1>

              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-2">
                Interiors, furniture, fabrication and painting — from one place. Tell us what you
                need and we put three verified professionals in front of you, each with a written
                quote you can actually compare.
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

              <div className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-8">
                <Stat value={`${(stats.projects / 1000).toFixed(1)}K+`} label="Projects completed" />
                <Stat value={stats.avgRating.toFixed(1)} label="Average rating" />
                <Stat value="₹0" label="Cost to get quotes" />
              </div>
            </div>

            {/* Layered hero imagery */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-3.5">
                  <div className="aspect-[3/4] overflow-hidden rounded-xl">
                    <Media src="ph:interior:hero-1" alt="Interior project" rounded={false} />
                  </div>
                  <div className="aspect-square overflow-hidden rounded-xl">
                    <Media src="ph:fabrication:hero-2" alt="Fabrication work" rounded={false} />
                  </div>
                </div>
                <div className="space-y-3.5 pt-8">
                  <div className="aspect-square overflow-hidden rounded-xl">
                    <Media src="ph:painting:hero-3" alt="Painting work" rounded={false} />
                  </div>
                  <div className="aspect-[3/4] overflow-hidden rounded-xl">
                    <Media src="ph:furniture:hero-4" alt="Furniture work" rounded={false} />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-4 -left-4 hidden w-64 rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow-lift)] sm:block">
                <div className="flex items-center gap-2">
                  <Stars value={5} />
                  <span className="text-[13.5px] sm:text-[12.5px] font-medium text-ink">3 quotes in 4 days</span>
                </div>
                <p className="mt-2 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-3">
                  “They were genuinely comparable, which is what I could not manage on my own.”
                </p>
                <p className="mt-2 text-[12.5px] sm:text-[11.5px] text-ink-4">Ritu A. · Lucknow</p>
              </div>
            </div>
          </div>
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
