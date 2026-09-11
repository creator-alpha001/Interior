import Link from "next/link";
import {
  countCatalogueByDomain,
  getSessionUser,
  getPlatformStats,
  listBanners,
  listDomains,
  listFeaturedPackages,
  listCities,
  listPosts,
  listProducts,
  getActor,
  listLeadsForClient,
  listProfessionals,
  listTestimonials,
} from "@repo/data";
import { PackageCard, PostCard, ProductCard, ProfessionalCard } from "@/components/cards";
import { getSelectedCity } from "@/lib/city";
import { CustomerHomePanel } from "@/components/site/customer-home-panel";
import { SetupNudge } from "@/components/site/setup-nudge";
import { WhereAreYouPrompt } from "@/components/site/where-are-you-prompt";
import {
  ButtonLink,
  Container,
  Media,
  Section,
  SectionHeading,
  Stars,
  cn,
} from "@repo/ui";

/** What the platform guarantees, said once, under the promise. */
const assurances = [
  "Verified professionals, per trade",
  "Your number is never shared",
  "One written agreement to handover",
];

/**
 * The comparison.
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

/** Each step carries a photograph of the moment it describes. */
const steps = [
  {
    title: "Tell us how you live",
    body: "One short form. Pick one service or several — a single dining table and a full home take the same two minutes.",
    photo: "/images/stock/default/5.jpg",
  },
  {
    title: "Meet three professionals",
    body: "Verified vendors for each service, in your city. We speak to them first, so everyone you meet is available.",
    photo: "/images/stock/default/6.jpg",
  },
  {
    title: "They visit and quote",
    body: "Each measures the job on site, then writes a quote with a timeline, warranty and materials.",
    photo: "/images/stock/default/7.jpg",
  },
  {
    title: "Compare side by side",
    body: "One table per service. Price, timeline, warranty, materials, rating. No sales pressure.",
    photo: "/images/stock/interior/5.jpg",
  },
  {
    title: "Sign and move in",
    body: "A written agreement, then day-by-day progress until handover. Rate the work when it is done.",
    photo: "/images/stock/default/1.jpg",
  },
];

export default async function HomePage() {
  /**
   * The feed follows the city, and follows the account before the cookie.
   *
   * Null is the honest answer for somebody who has not said where they are, and
   * it is passed straight down: every catalogue query below treats an absent
   * city as "every city", so they see the whole platform rather than one city's
   * prices presented as the only ones.
   */
  const [city, session, actor] = await Promise.all([
    getSelectedCity(),
    getSessionUser(),
    getActor(),
  ]);

  /**
   * A signed-in customer's own requirements.
   *
   * Guarded twice over. `getActor()` rather than the session user, because the
   * latter fills in the seeded demo person where nobody has signed in — and a
   * home page must never greet a stranger with somebody else's requirements.
   * And the failure is swallowed rather than thrown: this strip is a courtesy
   * on a browsing page, and taking the whole landing page down because one
   * per-account read failed is how a site ends up blank for everybody.
   */
  const isCustomer = Boolean(session && actor?.role === "client");
  const myLeads = isCustomer ? await listLeadsForClient().catch(() => []) : [];

  const [
    domains,
    cities,
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
    listCities(),
    listBanners(),
    countCatalogueByDomain(),
    listFeaturedPackages(3),
    listProducts({ sort: "featured", limit: 8, cityId: city?.id }),
    listProfessionals({ verifiedOnly: true, limit: 3, cityId: city?.id }),
    listTestimonials(),
    listPosts({ limit: 3 }),
    getPlatformStats(),
  ]);

  const featuredProducts = productPage.items;
  const pros = proPage.items;
  const posts = postPage.items;

  const countFor = (domainId: string) => counts.find((c) => c.domainId === domainId);
  const closing = banners[0];
  const firstName = isCustomer ? session!.name.trim().split(/\s+/)[0] : null;

  return (
    <>
      {/*
        The setup questions a customer skipped, as one quiet line above
        everything — not a card that takes the first screen. People who are
        signed in some other way and have no city get the city question alone.
      */}
      {isCustomer ? (
        <SetupNudge
          cities={cities}
          needsCity={!session!.cityId}
          needsNumber={!session!.mobile || !session!.mobileVerified}
        />
      ) : session && !session.cityId ? (
        <WhereAreYouPrompt cities={cities} />
      ) : null}

      {/* ---------------- Hero ---------------- */}
      <section className="relative isolate overflow-hidden bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/stock/hero/1.jpg"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        {/* Darkest behind the words, clear over the room. */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/45 to-black/5" />

        <Container width="wide" className="py-16 sm:py-24 lg:py-28">
          <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="text-white">
              <p className="text-[14px] font-medium text-white/80 sm:text-[13px]">
                {firstName ? `Welcome back, ${firstName}` : "Interiors · Furniture · Fabrication · Painting"}
              </p>

              <h1 className="mt-4 max-w-[12ch] text-[44px] font-semibold leading-[1.04] tracking-[-0.03em] text-white sm:text-[64px]">
                Homes that feel like you
              </h1>

              <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/85 sm:text-[18px]">
                Design, furniture and finishes shaped around how you live — by verified local
                professionals.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/submit-requirement" size="lg" variant="onDark" className="w-full sm:w-auto">
                  Get free design quotes
                </ButtonLink>
                <Link
                  href="/our-work"
                  className="inline-flex h-[3.25rem] w-full items-center justify-center rounded-full border border-white/45 bg-white/10 px-7 text-[16px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:h-12 sm:w-auto sm:text-[15px]"
                >
                  Explore designs
                </Link>
              </div>

              <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2">
                {assurances.map((line) => (
                  <li key={line} className="flex items-center gap-2 text-[14px] text-white/80 sm:text-[13.5px]">
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-white" aria-hidden="true">
                      <path d="M6.5 11.4L3.3 8.2l1-1 2.2 2.2 5-5 1 1-6 6z" />
                    </svg>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            {/* Two more rooms, as a glimpse of range rather than a gallery. */}
            <div className="hidden grid-cols-2 gap-4 lg:grid">
              {[
                { src: "/images/stock/hero/2.jpg", caption: "Warm, lived-in living rooms" },
                { src: "/images/stock/hero/3.jpg", caption: "Kitchens that fit the space" },
              ].map((tile, i) => (
                <figure
                  key={tile.src}
                  className={cn(
                    "overflow-hidden rounded-xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm",
                    i === 1 && "translate-y-10",
                  )}
                >
                  <Media src={tile.src} alt={tile.caption} rounded={false} priority className="aspect-[3/4]" />
                  <figcaption className="px-3 py-2.5 text-[13px] font-medium text-white">
                    {tile.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* A customer's own requirements, when they have any. Nothing when not. */}
      {isCustomer ? <CustomerHomePanel leads={myLeads} /> : null}

      {/* ---------------- Services ---------------- */}
      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Start with what you need"
            title="A room, a piece or a wall"
            description="Every professional is approved per trade, so the people you meet are specialists in exactly the work you asked for."
            action={
              <ButtonLink href="/catalogue" variant="secondary" size="sm">
                Full catalogue
              </ButtonLink>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {domains.map((domain) => {
              const count = countFor(domain.id);
              return (
                <Link
                  key={domain.id}
                  href={`/catalogue/${domain.slug}`}
                  className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-xl"
                >
                  <div className="absolute inset-0 -z-10 transition-transform duration-500 group-hover:scale-[1.05]">
                    <Media
                      src={domain.bannerUrl ?? `ph:${domain.slug}:home-${domain.id}`}
                      alt=""
                      rounded={false}
                    />
                  </div>
                  <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
                  <div className="p-5 text-white">
                    <h3 className="text-[20px] text-white">{domain.name}</h3>
                    <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-white/80 sm:text-[13.5px]">
                      {domain.tagline}
                    </p>
                    <p className="mt-3 flex items-center justify-between text-[13px] text-white/70 sm:text-[12.5px]">
                      <span>
                        {count?.products ?? 0} designs · {count?.packages ?? 0} packages
                      </span>
                      <span
                        className="grid h-8 w-8 place-items-center rounded-full bg-white/15 transition-colors group-hover:bg-white group-hover:text-ink"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* ---------------- Proof strip ---------------- */}
      {/*
        Figures that are true at this size. The previous strip divided the
        project count by a thousand, so a real early number printed as "0.0K+",
        and averaged a rating across two reviews as though it meant something.
      */}
      <section className="border-y border-line bg-surface">
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
                  "flex flex-col gap-1 px-6 py-6 sm:px-8",
                  i < 3 && "lg:border-r lg:border-line",
                  i % 2 === 0 && "border-r border-line lg:border-r",
                  i < 2 && "border-b border-line lg:border-b-0",
                )}
              >
                <dt className="order-2 text-[13.5px] text-ink-3 sm:text-[13px]">{item.label}</dt>
                <dd className="order-1 font-display text-[28px] leading-none tabular-nums text-ink sm:text-[30px]">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* ---------------- Designs ---------------- */}
      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Designs to start from"
            title="Pick a look. We make it to your size."
            description="Nothing here is off-the-shelf stock. Choose a design, tell us your measurements, and a verified professional builds it for your home."
            action={
              <ButtonLink href="/catalogue" variant="secondary" size="sm">
                Browse all
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

      {/* ---------------- The comparison ---------------- */}
      {/*
        Three written quotes against one scope is the thing the platform does
        that a directory or a contact form cannot. It used to be the hero; the
        promise leads now, and this is the proof of how it is kept.
      */}
      <Section tone="surface">
        <Container width="wide">
          <div className="grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay sm:text-[11px]">
                How you choose
              </p>
              <h2 className="mt-3 text-[28px] sm:text-[36px]">Three quotes. One table. No sales calls.</h2>
              <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-2">
                Every quote is written against the same scope and materials list, so the numbers
                actually mean the same thing — and you choose the one that feels right, in your own
                time.
              </p>
              <div className="mt-6 hidden overflow-hidden rounded-xl sm:block">
                <Media
                  src="/images/stock/interior/6.jpg"
                  alt="A finished modular kitchen"
                  rounded={false}
                  className="aspect-[16/9]"
                />
              </div>
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
                      <tr key={q.vendor} className={cn("border-t border-line", q.chosen && "bg-brand-soft")}>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-[14.5px] font-medium sm:text-[14px]",
                            q.chosen ? "text-brand" : "text-ink",
                          )}
                        >
                          {q.vendor}
                        </td>
                        <td
                          className={cn(
                            "px-5 py-3.5 text-[14.5px] tabular-nums sm:text-[14px]",
                            q.chosen ? "font-semibold text-brand" : "text-ink-2",
                          )}
                        >
                          {q.price}
                        </td>
                        <td className={cn("px-5 py-3.5 text-[14.5px] sm:text-[14px]", q.chosen ? "text-brand" : "text-ink-2")}>
                          {q.timeline}
                        </td>
                        <td className={cn("px-5 py-3.5 text-[14.5px] sm:text-[14px]", q.chosen ? "text-brand" : "text-ink-2")}>
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
      </Section>

      {/* ---------------- Packages ---------------- */}
      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Ready-made packages"
            title="Priced scopes, nothing hidden"
            description="Each package lists exactly what is included and what is not. Pick one and three professionals will quote against that exact scope."
            action={
              <ButtonLink href="/packages" variant="secondary" size="sm">
                All packages
              </ButtonLink>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredPackages.map((pkg) => (
              <PackageCard key={pkg.servicePackage.id} view={pkg} />
            ))}
          </div>
        </Container>
      </Section>

      {/* ---------------- How it works ---------------- */}
      <Section tone="surface">
        <Container width="wide">
          <SectionHeading
            eyebrow="How it works"
            title="From first idea to moving in"
            description="The same five steps whether you want one wardrobe or a whole home across three trades."
          />
          <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step, i) => (
              <li key={step.title} className="overflow-hidden rounded-xl border border-line bg-paper">
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Media src={step.photo} alt="" rounded={false} />
                  <span className="absolute left-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-white text-[13px] font-semibold tabular-nums text-brand shadow-sm">
                    {i + 1}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-[15px] leading-snug text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-ink-3 sm:text-[13px]">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <ButtonLink href="/submit-requirement">Start with a free consultation</ButtonLink>
          </div>
        </Container>
      </Section>

      {/* ---------------- Professionals ---------------- */}
      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="The people who do the work"
            title="Verified, and rated per trade"
            description="A vendor who is excellent at painting and average at carpentry shows exactly that. Ratings are held per trade, not averaged into one flattering number."
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
          <SectionHeading eyebrow="Customers" title="Homes our customers love" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {testimonials.map((t) => (
              <figure key={t.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
                <div className="aspect-[16/10] overflow-hidden">
                  <Media src={`ph:default:${t.id}`} alt={`${t.clientName}'s home`} rounded={false} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <Stars value={t.rating} />
                  <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-2 sm:text-[14px]">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-4 border-t border-line pt-3 text-[13.5px] text-ink-4 sm:text-[12.5px]">
                    <span className="font-medium text-ink-2">{t.clientName}</span> · {t.cityName}
                  </figcaption>
                </div>
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
      <section className="relative isolate overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/stock/hero/2.jpg"
          alt=""
          loading="lazy"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 to-black/35" />
        <Container width="wide" className="py-16 sm:py-20">
          <div className="flex flex-wrap items-center justify-between gap-8">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70 sm:text-[11px]">
                {closing?.title ?? "Free · no obligation"}
              </p>
              <h2 className="mt-3 max-w-[22ch] text-[30px] leading-tight text-white sm:text-[38px]">
                {closing?.subtitle ?? "Start with a conversation about your home"}
              </h2>
            </div>
            <ButtonLink href={closing?.ctaHref ?? "/submit-requirement"} variant="onDark" size="lg">
              {closing?.ctaLabel ?? "Get free design quotes"}
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
