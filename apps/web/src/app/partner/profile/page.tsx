import {
  formatRupees,
  getVendorDashboard,
  getVendorPerformance,
  listCities,
  listMyAchievements,
  listVendorPortfolio,
} from "@repo/data";
import { Badge, formatDate } from "@repo/ui";
import { Metric, PageBody, PageHeader, Panel } from "@/components/partner/panel-ui";
import { AchievementsManager, PortfolioManager } from "@/components/partner/showcase-manager";

export const metadata = { title: "Profile" };

export default async function VendorProfilePage() {
  const [dashboard, performance, portfolio, achievements, cities] = await Promise.all([
    getVendorDashboard(),
    getVendorPerformance(),
    listVendorPortfolio(),
    listMyAchievements(),
    listCities(),
  ]);

  const { professional } = dashboard;
  // Work can only be posted under a trade the vendor is approved for.
  const approvedTrades = dashboard.domains
    .filter((d) => d.link.verificationStatus === "approved")
    .map((d) => d.domain);

  return (
    <>
      <PageHeader
        title={professional.companyName}
        subtitle={`${dashboard.displayName} · ${professional.experienceYears} years · ${
          professional.verificationStatus === "verified"
            ? "verified account"
            : professional.verificationStatus === "pending"
              ? "verification pending"
              : professional.verificationStatus
        }`}
      />

      <PageBody className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Overall rating" value={professional.avgRating.toFixed(1)} hint={`${professional.ratingCount} reviews`} />
          <Metric label="Completed" value={professional.completedProjects} hint="Jobs delivered" />
          <Metric label="Response time" value={`~${performance.avgResponseHours}h`} hint="To our coordinator" />
          <Metric label="Revenue" value={formatRupees(performance.totalRevenue)} hint="Through the platform" />
        </div>

        {/* What customers see first on a public profile, so it leads here too. */}
        <PortfolioManager items={portfolio} trades={approvedTrades} cities={cities} />

        <AchievementsManager items={achievements} />

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
