import {
  formatRupees,
  getVendorDashboard,
  getVendorPerformance,
  listVendorPortfolio,
} from "@repo/data";
import { Badge, Media, formatDate } from "@repo/ui";
import { Metric, PageBody, PageHeader, Panel } from "@/components/partner/panel-ui";

export const metadata = { title: "Profile" };

export default async function VendorProfilePage() {
  const [dashboard, performance, portfolio] = await Promise.all([
    getVendorDashboard(),
    getVendorPerformance(),
    listVendorPortfolio(),
  ]);

  const { professional } = dashboard;

  return (
    <>
      <PageHeader
        title={professional.companyName}
        subtitle={`${dashboard.displayName} · ${professional.experienceYears} years · verified ${
          professional.verificationStatus === "verified" ? "account" : `(${professional.verificationStatus})`
        }`}
      />

      <PageBody className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Overall rating" value={professional.avgRating.toFixed(1)} hint={`${professional.ratingCount} reviews`} />
          <Metric label="Completed" value={professional.completedProjects} hint="Jobs delivered" />
          <Metric label="Response time" value={`~${performance.avgResponseHours}h`} hint="To our coordinator" />
          <Metric label="Revenue" value={formatRupees(performance.totalRevenue)} hint="Through the platform" />
        </div>

        {/* Per-trade performance is the whole point of the domain model. */}
        <Panel title="Performance by trade">
          <div className="space-y-3">
            {performance.byDomain.map((row) => (
              <div key={row.domain.id} className="rounded-md border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-medium text-ink">{row.domain.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{row.commissionPercent}% commission</Badge>
                    <span className="tnum text-[13px] font-semibold text-ink">
                      {row.rating.toFixed(1)}★
                    </span>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["Won", row.won],
                    ["Lost", row.lost],
                    ["Win rate", `${row.winRatePercent}%`],
                    ["Completed", row.completed],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-md bg-paper py-1.5">
                      <div className="text-[10.5px] uppercase tracking-wider text-ink-4">
                        {label}
                      </div>
                      <div className="tnum text-[13px] font-semibold text-ink">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">
            Ratings are held separately per trade, so being excellent at one is never diluted by
            another. To take work in a trade you are not approved for, ask our team — approval is
            per trade and is never self-service.
          </p>
        </Panel>

        <Panel title={`Portfolio (${portfolio.length})`}>
          {portfolio.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-3">
              No work published yet. Photos of completed jobs are what customers look at first.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.map((item) => (
                <figure key={item.id} className="overflow-hidden rounded-md border border-line">
                  <div className="aspect-[4/3]">
                    <Media
                      src={item.media[0]?.url ?? "ph:default:x"}
                      alt={item.title}
                      rounded={false}
                    />
                  </div>
                  <figcaption className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-ink">{item.title}</span>
                      <Badge
                        tone={item.moderationStatus === "approved" ? "positive" : "warning"}
                      >
                        {item.moderationStatus}
                      </Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] text-ink-3">{item.description}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-ink-4">
            Photos are moderated before they appear on your public profile.
          </p>
        </Panel>

        <Panel title={`Reviews (${performance.reviews.length})`} bodyClassName="p-0">
          {performance.reviews.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-3">
              No reviews yet. They are left per job, so each service you deliver is rated on its own.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {performance.reviews.map(({ review, domain, clientName }) => (
                <li key={review.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink">{review.rating}★</span>
                      <span className="text-[12.5px] text-ink-2">{clientName}</span>
                      <Badge tone="neutral">{domain.name}</Badge>
                    </div>
                    <span className="text-[11.5px] text-ink-4">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{review.comment}</p>
                  {review.timelinessRating ? (
                    <p className="mt-1 text-[11px] text-ink-4">
                      Quality {review.qualityRating}/5 · Timeliness {review.timelinessRating}/5 ·
                      Professionalism {review.professionalismRating}/5
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Business details">
          <dl className="space-y-2">
            {[
              ["Contact", dashboard.displayName],
              ["GST", professional.gstNumber ?? "Not registered"],
              ["Languages", professional.languages.join(", ")],
              ["Bio", professional.bio],
            ].map(([label, value]) => (
              <div key={label} className="border-b border-line pb-2 last:border-0">
                <dt className="text-[11px] uppercase tracking-wider text-ink-4">{label}</dt>
                <dd className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </PageBody>
    </>
  );
}
