import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  formatRupees,
  getPackageBySlug,
  listPackages,
  listProfessionals,
} from "@repo/data";
import { PackageCard, ProfessionalCard } from "@/components/cards";
import { MobileActionBar } from "@/components/catalogue/mobile-action-bar";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Container,
  Section,
  SectionHeading,
} from "@repo/ui";
import { Media } from "@repo/ui";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getPackageBySlug(slug);
  if (!view) return { title: "Not found" };
  return {
    title: view.servicePackage.name,
    description: view.servicePackage.shortDescription,
  };
}

export default async function PackagePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const view = await getPackageBySlug(slug);
  if (!view) notFound();

  const { servicePackage: pkg, domain, items } = view;
  const [proPage, siblings] = await Promise.all([
    listProfessionals({ domainSlug: domain.slug, verifiedOnly: true, limit: 3 }),
    listPackages(domain.slug),
  ]);

  const pros = proPage.items;

  const related = siblings.filter((s) => s.servicePackage.id !== pkg.id).slice(0, 3);

  return (
    <>
      <Container width="wide" className="py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Packages", href: "/packages" },
            { label: domain.name, href: `/packages?domain=${domain.slug}` },
            { label: pkg.name },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="aspect-[16/10] overflow-hidden rounded-xl">
              <Media src={pkg.media[0]?.url ?? "ph:default:x"} alt={pkg.name} rounded={false} />
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{domain.name}</Badge>
                {pkg.badge ? <Badge tone="clay">{pkg.badge}</Badge> : null}
                <Badge>{pkg.durationDays} days</Badge>
              </div>
              <h1 className="mt-4 text-[32px] leading-tight sm:text-[38px]">{pkg.name}</h1>
              <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{pkg.description}</p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-positive/25 bg-positive-soft p-5">
                <h2 className="font-sans text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-positive">
                  What is included
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {pkg.inclusions.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[15px] sm:text-[14px] text-ink-2">
                      <svg
                        viewBox="0 0 16 16"
                        className="mt-[3px] h-3.5 w-3.5 shrink-0 fill-positive"
                        aria-hidden="true"
                      >
                        <path d="M6.5 11.4L3.3 8.2l1-1 2.2 2.2 5-5 1 1-6 6z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-line bg-surface-2 p-5">
                <h2 className="font-sans text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                  Not included
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {pkg.exclusions.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[15px] sm:text-[14px] text-ink-3">
                      <svg
                        viewBox="0 0 16 16"
                        className="mt-[3px] h-3.5 w-3.5 shrink-0 fill-ink-4"
                        aria-hidden="true"
                      >
                        <path d="M4.5 4.5l7 7-1 1-7-7 1-1zm7 0l1 1-7 7-1-1 7-7z" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-4">
                  Anything on this list can still be added — it is quoted separately so the package
                  price stays comparable between vendors.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-[24px]">Line items in this package</h2>
              <div className="mt-4 overflow-hidden rounded-xl border border-line">
                <table className="w-full text-[15px] sm:text-[14px]">
                  <thead className="bg-surface-2 text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-3">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Item</th>
                      <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="bg-surface">
                    {items.map((item, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="px-4 py-3 text-ink-2">{item.label}</td>
                        <td className="px-4 py-3 text-right font-medium text-ink">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sticky quote panel */}
          <div>
            <div className="lg:sticky lg:top-24">
              <div className="rounded-xl border border-line bg-surface p-6">
                <div className="text-[13px] sm:text-[12px] text-ink-4">Indicative package price</div>
                <div className="mt-1 font-display text-[36px] leading-none text-ink">
                  {formatRupees(pkg.price)}
                </div>
                <div className="mt-2 text-[14px] sm:text-[13px] text-ink-3">{pkg.priceBasis}</div>

                <dl className="mt-6 border-t border-line pt-4">
                  <div className="flex items-baseline justify-between border-b border-line py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Typical duration</dt>
                    <dd className="text-[14.5px] sm:text-[13.5px] font-medium text-ink">{pkg.durationDays} days</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-line py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Service</dt>
                    <dd className="text-[14.5px] sm:text-[13.5px] font-medium text-ink">{domain.name}</dd>
                  </div>
                  <div className="flex items-baseline justify-between py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Quotes you get</dt>
                    <dd className="text-[14.5px] sm:text-[13.5px] font-medium text-ink">3 professionals</dd>
                  </div>
                </dl>

                <ButtonLink
                  href={`/submit-requirement?package=${pkg.slug}`}
                  size="lg"
                  className="mt-6 w-full"
                >
                  Get 3 quotes for this package
                </ButtonLink>
                <p className="mt-3 text-center text-[13px] sm:text-[12px] leading-relaxed text-ink-4">
                  Free, and no obligation. Professionals visit, measure, and quote against this
                  exact scope.
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-clay-line bg-clay-soft p-5">
                <h3 className="font-sans text-[14px] sm:text-[13px] font-semibold text-clay">
                  Why the price still moves
                </h3>
                <p className="mt-2 text-[14px] sm:text-[13px] leading-relaxed text-ink-2">
                  Package prices assume a standard size and straightforward site access. A larger
                  home, a fourth-floor walk-up, or material you supply yourself all change the
                  figure — which is exactly what the site visit is for.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Container>

      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Who delivers it"
            title={`${domain.name} professionals`}
            description="Approved specifically for this trade, with ratings held per domain."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pros.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} contextDomain={domain.name} />
            ))}
          </div>
        </Container>
      </Section>

      <MobileActionBar
        price={pkg.price}
        priceLabel={pkg.priceBasis}
        href={`/submit-requirement?package=${pkg.slug}`}
        cta="Get 3 quotes"
        note="Free · professionals visit, measure and quote"
      />

      {related.length > 0 ? (
        <Section tone="surface">
          <Container width="wide">
            <SectionHeading eyebrow="Compare" title="Other packages in this service" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PackageCard key={p.servicePackage.id} view={p} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
