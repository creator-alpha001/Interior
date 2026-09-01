import type { Metadata } from "next";
import { listDomains } from "@repo/data";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Card,
  Container,
  Section,
  SectionHeading,
} from "@repo/ui";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How requirements are routed, how professionals are assigned and verified, how agreements are grouped, and how commission works.",
};

const customerSteps = [
  {
    title: "You submit one short form",
    body: "Name, mobile, city, what you need, a description in your own words, and when you want to start. If you selected more than one service, one extra question per service: who supplies the material. That is the whole form.",
    note: "We deliberately do not ask for BHK, carpet area, paint finish or exact dimensions. Those answers are guesses at enquiry stage, and a guess produces a bad quote.",
  },
  {
    title: "We call you",
    body: "A short call to capture the detail the form left out — exact rooms, sizes, finishes, site constraints. This is recorded against your requirement so every professional works from the same brief.",
  },
  {
    title: "Three professionals per service",
    body: "Our team calls vendors in your city who are approved for that specific service, confirms they are available and interested, and only then assigns them. Nobody is auto-assigned by an algorithm.",
    note: "A requirement covering two services gets three professionals for each — six in total, working independently.",
  },
  {
    title: "Site visits and written quotes",
    body: "We arrange each visit, confirming the slot with you and the professional separately. They measure, then upload a written quote with line items, timeline, warranty and material specification.",
    note: "Professionals are given your address for a confirmed visit and nothing else. Your phone number is never shared with them.",
  },
  {
    title: "Every question goes through us",
    body: "There is no direct line between you and the professionals, in either direction. You ask us; we put the question to all three and bring the answers back. One clarification improves three quotes instead of one, and you are not fielding calls from three different people.",
  },
  {
    title: "You compare and choose",
    body: "One comparison table per service, with the same columns for every quote. Choose whoever you want — lowest price, fastest, longest warranty, or the person you simply trusted most on site.",
  },
  {
    title: "Agreements, then work",
    body: "One agreement per professional. If one professional is doing two of your services, that is a single combined contract rather than two. Work is then tracked per service, with milestones, right through to handover.",
  },
];

export default async function HowItWorksPage() {
  const domains = await listDomains();

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "How it works" }]} />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[46px]">
            Three quotes, one decision, no pressure
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">
            The platform exists to solve one problem: it is almost impossible to compare two home
            improvement quotes, because no two vendors quote the same scope. Here is how we fix
            that.
          </p>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="default">
          <ol className="space-y-8">
            {customerSteps.map((step, i) => (
              <li key={step.title} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand font-display text-[17px] text-white">
                    {i + 1}
                  </span>
                  {i < customerSteps.length - 1 ? (
                    <span className="mt-2 w-px flex-1 bg-line" />
                  ) : null}
                </div>
                <div className="pb-2">
                  <h2 className="font-display text-[24px] text-ink">{step.title}</h2>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">{step.body}</p>
                  {step.note ? (
                    <p className="mt-3 rounded-lg border-l-2 border-clay bg-clay-soft px-4 py-3 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-2">
                      {step.note}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section tone="surface" id="professionals">
        <Container width="default">
          <SectionHeading
            eyebrow="Verification"
            title="What the verified badge actually means"
            description="It is not automatic, and it is not permanent."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Identity", "Government ID checked against the registered mobile number."],
              [
                "Contact conduct",
                "Professionals agree not to solicit your contact details or offer to work off-platform. Doing so is grounds for removal.",
              ],
              ["Business", "GST registration where applicable, or proof of trade otherwise."],
              ["Work history", "Photographs of at least five completed jobs, with locality and date."],
              ["Reference calls", "We speak to at least two past customers before approval."],
              [
                "Per-service approval",
                "Approval is granted per trade. A fabricator cannot start taking painting leads without separate approval.",
              ],
              [
                "Ongoing review",
                "Ratings and response time are tracked continuously. Two unresolved complaints move an account to review, and an account under review stops receiving leads.",
              ],
            ].map(([title, body]) => (
              <Card key={title}>
                <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">{body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="paper" id="commission">
        <Container width="default">
          <SectionHeading
            eyebrow="Money"
            title="What it costs"
            description="Nothing, for customers. Professionals pay a commission on work they win."
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="font-display text-[22px]">For customers</h3>
              <ul className="mt-4 space-y-3 text-[15px] sm:text-[14px] text-ink-2">
                {[
                  "Submitting a requirement is free.",
                  "Site visits and quotes are free, with no obligation to hire anyone.",
                  "Professionals never get your phone number. All contact runs through our team.",
                  "You pay the professional directly, on the terms written into your agreement.",
                  "We record those terms and track the work, but we do not hold your money.",
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <h3 className="font-display text-[22px]">For professionals</h3>
              <p className="mt-3 text-[15px] sm:text-[14px] leading-relaxed text-ink-2">
                Commission is calculated on the agreed price at the moment the agreement is signed,
                and is invoiced per agreement — a professional covering two services under one
                combined agreement receives one invoice, not two. Rates differ by service, because
                margins do.
              </p>
              <div className="mt-4 space-y-2">
                {domains.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between border-b border-line py-2 last:border-0"
                  >
                    <span className="text-[14.5px] sm:text-[13.5px] text-ink-2">{d.name}</span>
                    <Badge tone="brand">{d.defaultCommissionPercent}%</Badge>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[13.5px] sm:text-[12.5px] leading-relaxed text-ink-4">
                If a project is cancelled before work starts, commission is waived. Once work has
                started it stands at the agreed amount unless our team adjusts it.
              </p>
            </Card>
          </div>
        </Container>
      </Section>

      <Section tone="brand">
        <Container width="default">
          <div className="text-center">
            <h2 className="text-[32px] text-white sm:text-[40px]">Ready to start?</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15.5px] leading-relaxed text-white/70">
              Two minutes to submit. Three professionals per service. No payment until you decide.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/submit-requirement" variant="onDark" size="lg">
                Get free quotes
              </ButtonLink>
              <ButtonLink
                href="/catalogue"
                size="lg"
                className="border border-white/30 bg-transparent text-white hover:bg-white/10"
              >
                Browse the catalogue
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
