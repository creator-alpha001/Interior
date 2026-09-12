import type { Metadata } from "next";
import { getPlatformStats, listCities, listDomains } from "@repo/data";
import { Breadcrumbs, ButtonLink, Container, Media, Section, SectionHeading } from "@repo/ui";

/**
 * Who runs this, and how it makes money.
 *
 * Written from what the platform actually does. Every figure comes from the
 * database rather than a marketing round-up, so the page cannot drift from the
 * product: if coverage or the trade list changes, this changes with it.
 */
export const metadata: Metadata = {
  title: "About us",
  description:
    "Decora Shine is operated by Intellihive Solutions. Three written quotes per trade, professionals verified per trade, and one coordinator who answers.",
};

export default async function AboutPage() {
  const [stats, districts, domains] = await Promise.all([
    getPlatformStats(),
    listCities(),
    listDomains(),
  ]);

  const states = [...new Set(districts.filter((d) => d.isActive).map((d) => d.state))].sort();

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-8 sm:py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "About us" }]} />
          <div className="mt-5 grid items-center gap-8 lg:grid-cols-[1fr_minmax(0,460px)]">
            <div>
              <h1 className="max-w-3xl text-[32px] leading-tight sm:text-[40px]">
                We are the part between you and the person doing the work
              </h1>
              <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
                Getting a home job done means finding three people who will turn up, comparing
                quotes that describe different things, and then chasing everybody. Decora Shine is
                the layer that does all of that — we brief professionals, arrange the visits, bring
                back written quotes against one scope, and stay with the job until handover.
              </p>
              <ButtonLink href="/submit-requirement" size="lg" className="mt-6">
                Get free design quotes
              </ButtonLink>
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-line lg:block">
              <Media
                src="/images/stock/hero/2.jpg"
                alt="A finished living room"
                rounded={false}
                priority
                className="aspect-[4/3] w-full"
              />
            </div>
          </div>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="Who we are"
            title="Decora Shine is operated by Intellihive Solutions"
            description="One company, one brand. The name on the invoice is Intellihive Solutions; the name on the door is Decora Shine."
          />
          <div className="prose-article max-w-3xl">
            <p>
              We work with interior designers, furniture makers, fabricators and painters across
              {" "}
              {states.length === 1 ? states[0] : `${states.length} states`}, and we are careful
              about which of them we work with: approval is granted per trade, so a fabricator
              cannot start taking painting jobs without being checked separately for painting.
            </p>
            <p>
              Everything a customer sees follows from that. Ratings are held per trade rather than
              averaged into one flattering number. Quotes are written against the same scope, so
              the figures mean the same thing. Stages count as done when our team has seen
              photographs of the work, not when somebody says so.
            </p>
          </div>
        </Container>
      </Section>

      <section className="border-y border-line bg-surface">
        <Container width="wide" className="px-0">
          <dl className="grid grid-cols-2 lg:grid-cols-4">
            {[
              { value: String(stats.professionals), label: "Verified professionals" },
              { value: String(districts.filter((d) => d.isActive).length), label: "Districts served" },
              { value: String(domains.length), label: "Trades" },
              { value: "₹0", label: "Cost to get quotes" },
            ].map((item, i) => (
              <div
                key={item.label}
                className={
                  i < 3
                    ? "flex flex-col gap-1 border-b border-r border-line px-6 py-6 sm:px-8 lg:border-b-0"
                    : "flex flex-col gap-1 border-b border-line px-6 py-6 sm:px-8 lg:border-b-0"
                }
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

      <Section tone="paper">
        <Container width="wide">
          <SectionHeading
            eyebrow="How we make money"
            title="Professionals pay us, customers do not"
            description="Said plainly, because everyone asks and a vague answer is worse than an unwelcome one."
          />
          <div className="prose-article max-w-3xl">
            <p>
              Quotes are free and carry no obligation. When a customer chooses a professional and
              signs an agreement, that professional pays us a commission at the rate agreed for
              their trade. It does not change what the customer was quoted.
            </p>
            <p>
              <strong>We do not hold your money.</strong> Payment for the work is arranged directly
              between the customer and the professional. There is no escrow here, and any page that
              suggested otherwise would be wrong.
            </p>
          </div>
        </Container>
      </Section>

      <Section tone="surface">
        <Container width="wide">
          <SectionHeading eyebrow="Where to find us" title="Talk to a person" />
          <div className="prose-article max-w-3xl">
            <p>
              <strong>Intellihive Solutions</strong>
              <br />
              Faridabad, Haryana, India
              <br />
              <a href="mailto:hello@decorashine.com">hello@decorashine.com</a>
            </p>
            <p>
              For anything about your own data, including deletion, see our{" "}
              <a href="/privacy">privacy policy</a>. The terms we work under are on the{" "}
              <a href="/terms">terms page</a>.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
