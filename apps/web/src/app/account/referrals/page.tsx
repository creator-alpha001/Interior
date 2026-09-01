import { formatRupees, getReferralSummary } from "@repo/data";
import { ReferralShare } from "@/components/account/referral-share";
import { Badge, Card, EmptyState, formatDate } from "@repo/ui";

const rewardTone = {
  pending: "warning",
  earned: "brand",
  paid: "positive",
  expired: "neutral",
} as const;

const rewardLabel = {
  pending: "Awaiting their first project",
  earned: "Earned",
  paid: "Paid out",
  expired: "Expired",
} as const;

export default async function ReferralsPage() {
  const summary = await getReferralSummary();

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <p className="text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Friends invited</p>
          <p className="mt-2 font-display text-[34px] leading-none text-ink">{summary.invited}</p>
        </Card>
        <Card>
          <p className="text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Earned</p>
          <p className="mt-2 font-display text-[34px] leading-none text-positive">
            {formatRupees(summary.earned)}
          </p>
        </Card>
        <Card>
          <p className="text-[13px] sm:text-[12px] uppercase tracking-wider text-ink-4">Pending</p>
          <p className="mt-2 font-display text-[34px] leading-none text-ink">
            {formatRupees(summary.pending)}
          </p>
        </Card>
      </div>

      <ReferralShare code={summary.code} shareUrl={summary.shareUrl} reward={summary.rewardPerReferral} />

      <Card>
        <h2 className="text-[15px] font-semibold text-ink">How it works</h2>
        <ol className="mt-4 space-y-3">
          {[
            "Share your code with someone planning interiors, furniture, fabrication or painting.",
            "They submit a requirement using it — it costs them nothing, and they get the same three quotes you did.",
            `Once their first project starts, you both earn ${formatRupees(summary.rewardPerReferral)}.`,
          ].map((line, i) => (
            <li key={line} className="flex gap-3 text-[15px] sm:text-[14px] text-ink-2">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[13px] sm:text-[12px] font-semibold text-brand">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
        <p className="mt-4 border-t border-line pt-3 text-[13px] sm:text-[12px] leading-relaxed text-ink-4">
          Rewards are credited after the referred project starts, not when they sign up — which
          keeps the programme honest for everyone.
        </p>
      </Card>

      <div>
        <h2 className="mb-4 text-[22px]">Your referrals</h2>
        {summary.referrals.length === 0 ? (
          <EmptyState
            title="No referrals yet"
            description="Share your code above. You will see each friend here once they submit a requirement."
          />
        ) : (
          <div className="space-y-3">
            {summary.referrals.map(({ referral, name }) => (
              <div
                key={referral.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex items-center gap-3.5">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-soft font-display text-[17px] text-brand">
                    {name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-[15.5px] sm:text-[14.5px] font-medium text-ink">{name}</p>
                    <p className="text-[13.5px] sm:text-[12.5px] text-ink-4">
                      Joined {formatDate(referral.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[15px] sm:text-[14px] font-semibold text-ink">
                    {formatRupees(referral.rewardAmount)}
                  </span>
                  <Badge tone={rewardTone[referral.rewardStatus]}>
                    {rewardLabel[referral.rewardStatus]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
