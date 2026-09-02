import type { Metadata } from "next";
import { listEstimatorConfigs } from "@repo/data";
import { CostEstimator } from "@/components/estimator/cost-estimator";
import {
  Breadcrumbs,
  ButtonLink,
  Card,
  Container,
  Section,
  SectionHeading,
} from "@repo/ui";

export const metadata: Metadata = {
  title: "Estimate cost",
  description:
    "A rough cost bracket for interiors, furniture, fabrication and painting — priced the way each trade actually prices, with the exclusions stated.",
};

export default async function EstimatePage() {
  const configs = await listEstimatorConfigs();

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Estimate cost" }]} />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[44px]">
            What might this cost?
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            Enough to tell you whether a job is a lakh or five. Each trade is priced the way it
            actually gets priced — painting on painted area, fabrication per running foot, furniture
            per piece — and every result is a range, because at this stage nobody can honestly give
            you a single number.
          </p>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <CostEstimator configs={configs} />
        </Container>
      </Section>

      <Section tone="surface">
        <Container width="default">
          <SectionHeading
            eyebrow="Why it is a range"
            title="Three things move the final figure"
          />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [
                "Measurements",
                "Estimates use typical sizes. Your walls, your ceiling height and your window count are not typical, and the site visit is where that gets settled.",
              ],
              [
                "Who supplies material",
                "A quote is materials plus labour if the vendor sources it, and labour only if you do. That single answer can move a furniture job by 30%.",
              ],
              [
                "Site access",
                "A fourth-floor walk-up, a society that only allows work between 9 and 6, or a compound a truck cannot enter all change what a job costs to do.",
              ],
            ].map(([title, body]) => (
              <Card key={title}>
                <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">{body}</p>
              </Card>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-line bg-paper p-6 text-center">
            <p className="text-[15px] text-ink-2">
              Three professionals, three written quotes, no cost and no obligation.
            </p>
            <ButtonLink href="/submit-requirement" className="mt-5">
              Get free quotes
            </ButtonLink>
          </div>
        </Container>
      </Section>
    </>
  );
}
