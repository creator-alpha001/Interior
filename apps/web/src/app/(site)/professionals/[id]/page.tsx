import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfessional, domainById } from "@repo/data";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Container,
  RatingLine,
  Section,
  SectionHeading,
  Stars,
  VerifiedBadge,
} from "@repo/ui";
import { Media } from "@repo/ui";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const pro = await getProfessional(id);
  if (!pro) return { title: "Not found" };
  return { title: `${pro.name} — ${pro.companyName}`, description: pro.bio };
}

export default async function ProfessionalPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const pro = await getProfessional(id);
  if (!pro) notFound();

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Professionals", href: "/professionals" },
              { label: pro.name },
            ]}
          />

          <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-brand-soft font-display text-[34px] text-brand">
                {pro.name.charAt(0)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-[32px] leading-none sm:text-[38px]">{pro.name}</h1>
                  {pro.isVerified ? <VerifiedBadge /> : null}
                </div>
                <p className="mt-2 text-[16px] text-ink-2">{pro.companyName}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14.5px] sm:text-[13.5px] text-ink-3">
                  <RatingLine value={pro.avgRating} count={pro.ratingCount} />
                  <span>{pro.experienceYears} years experience</span>
                  <span>{pro.completedProjects} projects</span>
                  <span>Replies in ~{pro.avgResponseHours}h</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {pro.domains.map((d) => (
                    <Badge key={d.id} tone="brand">
                      {d.name}
                    </Badge>
                  ))}
                  {pro.serviceCities.map((c) => (
                    <Badge key={c.id}>{c.name}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="w-full shrink-0 sm:w-auto">
              <ButtonLink
                href={`/submit-requirement?pro=${pro.id}${
                  pro.domains.length === 1 ? `&domain=${pro.domains[0].slug}` : ""
                }`}
                size="lg"
                className="w-full sm:w-auto"
              >
                Ask for {pro.name.split(" ")[0]} on my job
              </ButtonLink>
              <p className="mt-2.5 max-w-[260px] text-[13px] sm:text-[12px] leading-relaxed text-ink-4">
                We will put them among your three quotes if they are free and cover your area — and
                tell you straight away if they are not. You still compare all three before choosing.
              </p>
            </div>
          </div>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h2 className="text-[24px]">About</h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">{pro.bio}</p>

              {pro.portfolio.length > 0 ? (
                <>
                  <h2 className="mt-12 text-[24px]">Recent work</h2>
                  <p className="mt-2 text-[15px] sm:text-[14px] text-ink-3">
                    Filtered by trade — a vendor&apos;s painting work does not clutter their
                    fabrication portfolio.
                  </p>
                  <div className="mt-6 grid gap-5 sm:grid-cols-2">
                    {pro.portfolio.map((item) => (
                      <figure
                        key={item.id}
                        className="overflow-hidden rounded-xl border border-line bg-surface"
                      >
                        <div className="aspect-[4/3]">
                          <Media
                            src={item.media[0]?.url ?? "ph:default:x"}
                            alt={item.title}
                            rounded={false}
                          />
                        </div>
                        <figcaption className="p-4">
                          <Badge tone="neutral">{domainById(item.domainId).name}</Badge>
                          <h3 className="mt-2.5 font-sans text-[15px] font-semibold text-ink">
                            {item.title}
                          </h3>
                          <p className="mt-1.5 text-[14px] sm:text-[13px] leading-relaxed text-ink-3">
                            {item.description}
                          </p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </>
              ) : null}

              {pro.reviews.length > 0 ? (
                <>
                  <h2 className="mt-12 text-[24px]">Reviews</h2>
                  <p className="mt-2 text-[15px] sm:text-[14px] text-ink-3">
                    Left per project, so a vendor who handled two trades for one customer carries
                    two separate ratings.
                  </p>
                  <div className="mt-6 space-y-4">
                    {pro.reviews.map(({ review, clientName, domain }) => (
                      <article key={review.id} className="rounded-xl border border-line bg-surface p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Stars value={review.rating} />
                            <span className="text-[15px] sm:text-[14px] font-medium text-ink">{clientName}</span>
                          </div>
                          <Badge tone="neutral">{domain.name}</Badge>
                        </div>
                        <p className="mt-3 text-[15.5px] sm:text-[14.5px] leading-relaxed text-ink-2">
                          {review.comment}
                        </p>
                        {review.qualityRating ? (
                          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-3 text-[13.5px] sm:text-[12.5px]">
                            <div>
                              <dt className="text-ink-4">Quality</dt>
                              <dd className="font-medium text-ink">{review.qualityRating}/5</dd>
                            </div>
                            <div>
                              <dt className="text-ink-4">Timeliness</dt>
                              <dd className="font-medium text-ink">{review.timelinessRating}/5</dd>
                            </div>
                            <div>
                              <dt className="text-ink-4">Professionalism</dt>
                              <dd className="font-medium text-ink">
                                {review.professionalismRating}/5
                              </dd>
                            </div>
                          </dl>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-surface p-6">
                <h3 className="font-sans text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                  Rating by service
                </h3>
                <div className="mt-4 space-y-4">
                  {pro.domainStats.map((stat) => {
                    const domain = domainById(stat.domainId);
                    return (
                      <div key={stat.id}>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[15px] sm:text-[14px] font-medium text-ink">{domain.name}</span>
                          <span className="text-[14px] sm:text-[13px] text-ink-3">
                            {stat.avgRating.toFixed(1)} · {stat.ratingCount} reviews
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${(stat.avgRating / 5) * 100}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[13px] sm:text-[12px] text-ink-4">
                          {stat.completedProjects} projects completed
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-6">
                <h3 className="font-sans text-[14px] sm:text-[13px] font-semibold uppercase tracking-[0.1em] text-ink-4">
                  Details
                </h3>
                <dl className="mt-4">
                  <div className="flex items-baseline justify-between border-b border-line py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Based in</dt>
                    <dd className="text-[14.5px] sm:text-[13.5px] font-medium text-ink">{pro.city.name}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-line py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Serves</dt>
                    <dd className="text-right text-[14.5px] sm:text-[13.5px] font-medium text-ink">
                      {pro.serviceCities.map((c) => c.name).join(", ")}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-line py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">Languages</dt>
                    <dd className="text-right text-[14.5px] sm:text-[13.5px] font-medium text-ink">
                      {pro.languages.join(", ")}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-line py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">GST registered</dt>
                    <dd className="text-[14.5px] sm:text-[13.5px] font-medium text-ink">
                      {pro.professional.gstNumber ? "Yes" : "Not registered"}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between py-2.5">
                    <dt className="text-[14px] sm:text-[13px] text-ink-3">On platform since</dt>
                    <dd className="text-[14.5px] sm:text-[13.5px] font-medium text-ink">
                      {new Date(pro.professional.createdAt).getFullYear()}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="brand">
        <Container width="wide">
          <SectionHeading
            title="Compare before you commit"
            description="Every requirement goes to three professionals. You see all three quotes side by side, with price, timeline, warranty and materials laid out in the same table."
            invert
            action={
              <ButtonLink href="/submit-requirement" variant="onDark">
                Get free quotes
              </ButtonLink>
            }
          />
        </Container>
      </Section>
    </>
  );
}
