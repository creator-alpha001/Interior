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
  title: "Join as a professional",
  description:
    "Receive verified leads for the trades you are approved for. No listing fee — commission only on work you win.",
};

export default async function JoinPage() {
  const domains = await listDomains();

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Join as a professional" }]}
          />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[46px]">
            Leads that have already been qualified
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">
            Every lead you receive has been spoken to by our team, scoped on a call, and confirmed
            as genuine. You pay nothing to be listed and nothing per lead — commission is charged
            only on work you actually win.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/submit-requirement" size="lg">
              Apply to join
            </ButtonLink>
            <ButtonLink href="/how-it-works#commission" variant="secondary" size="lg">
              See commission rates
            </ButtonLink>
          </div>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="default">
          <SectionHeading
            eyebrow="Register once"
            title="Work across more than one trade"
            description="A fabricator who also paints can be approved for both and receive leads from both pools. Approval is per trade and goes through our team, which is what keeps quality per service meaningful."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {domains.map((d) => (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-[21px]">{d.name}</h3>
                  <Badge tone="brand">{d.defaultCommissionPercent}% commission</Badge>
                </div>
                <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-ink-3">{d.description}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container width="default">
          <SectionHeading eyebrow="What you need" title="To get verified" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Government ID", "Verified against your registered mobile number."],
              ["GST certificate", "Where you are registered. Not mandatory for smaller workshops."],
              ["Five work photos", "Recent completed jobs, with locality and approximate date."],
              ["Two references", "Past customers we can call."],
              ["Service areas", "The cities and localities you actually travel to."],
              ["Bank details", "For commission invoicing. Added after approval."],
              [
                "Contact policy",
                "Customer phone numbers are never shared. You receive the locality up front and the full address for a confirmed visit. Soliciting direct contact or off-platform work ends the account.",
              ],
            ].map(([title, body]) => (
              <Card key={title}>
                <h3 className="text-[15.5px] sm:text-[14.5px] font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-[14px] sm:text-[13px] leading-relaxed text-ink-3">{body}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      <Section tone="brand">
        <Container width="default">
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              ["No listing fee", "You are never charged to be on the platform or to receive a lead."],
              [
                "One invoice per agreement",
                "Handle two services for one customer under a combined agreement and you get one invoice, not two.",
              ],
              [
                "One brief, one clarification",
                "Questions come to you through our coordinator, already answered by the customer. You are not chasing anyone for a decision, and every vendor quotes the same scope.",
              ],
            ].map(([title, body]) => (
              <div key={title} className="border-t border-white/20 pt-5">
                <h3 className="font-sans text-[15px] font-semibold text-white">{title}</h3>
                <p className="mt-2 text-[14.5px] sm:text-[13.5px] leading-relaxed text-white/70">{body}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
