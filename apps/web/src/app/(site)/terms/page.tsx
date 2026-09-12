import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container, Section } from "@repo/ui";

/**
 * The terms of use.
 *
 * The load-bearing sentence is the one about money: Decora Shine introduces
 * and coordinates, and payment is arranged directly between the customer and
 * the professional. The platform holds no escrow, and every surface that
 * mentions payment says the same thing — if this page ever drifts from that,
 * it is this page that is wrong.
 */
export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The terms on which Decora Shine introduces customers to verified professionals, and what each side is responsible for.",
};

const UPDATED = "12 September 2026";

export default function TermsPage() {
  return (
    <Section tone="paper">
      <Container width="narrow" className="py-10 sm:py-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Terms of use" }]} />

        <h1 className="mt-5 text-[32px] leading-tight sm:text-[40px]">Terms of use</h1>
        <p className="mt-3 text-[14px] text-ink-3">Last updated {UPDATED}</p>

        <div className="prose-article mt-8">
          <p>
            These terms apply to decorashine.com and the Decora Shine app, both operated by
            Intellihive Solutions. Using either means you accept them.
          </p>

          <h2>What Decora Shine does</h2>
          <p>
            We introduce you to professionals for interiors, furniture, fabrication and
            painting, and we coordinate the process: we take your requirement, brief
            professionals in your city who are approved for that trade, arrange site visits,
            bring back written quotes, and keep one conversation open with you until the work
            is handed over.
          </p>
          <p>
            <strong>The work itself is carried out by the professional you choose, not by us.</strong>{" "}
            Your agreement for the work is with them.
          </p>

          <h2>Money</h2>
          <p>
            Getting quotes is free, and you are under no obligation to accept any of them.
          </p>
          <p>
            <strong>Payments for the work are arranged directly between you and the
            professional.</strong> Decora Shine does not take, hold or escrow your payment for
            the work. Professionals pay us a commission on jobs they win, which does not change
            what you are quoted.
          </p>

          <h2>Quotes, agreements and visits</h2>
          <p>
            A quote is written by a professional against the brief we gave them. Where a
            requirement covers more than one trade, each trade is quoted, scheduled and
            completed separately, even when the same professional does several of them.
          </p>
          <p>
            Choosing a quote produces a written agreement, which you sign before work begins.
            Naming a professional you would prefer is a preference we try to honour, not a
            booking — you will still see other quotes so you can compare.
          </p>

          <h2>Your side</h2>
          <ul>
            <li>Give accurate information about the job, the property and how to reach you.</li>
            <li>Be present, or have somebody present, for confirmed site visits.</li>
            <li>Do not use the platform to arrange anything unlawful.</li>
            <li>
              Only upload photographs you are entitled to share, and nothing that identifies
              another person without their agreement.
            </li>
          </ul>

          <h2>If you are a professional</h2>
          <ul>
            <li>
              You may only quote for and post work in trades our team has approved you for, and
              only under a business you are entitled to represent.
            </li>
            <li>
              Work and achievements you post appear on your public profile immediately. Post
              only photographs of jobs you carried out yourself. We may take down anything that
              is not yours, is misleading, or breaks these terms, and we will tell you why.
            </li>
            <li>
              Ratings are held per trade and are written by customers after a completed job.
              They are theirs, not ours, and we do not edit them to suit either side.
            </li>
            <li>Commission is charged at the rate agreed for that trade when a customer signs.</li>
            <li>
              A customer's address is released to you when a visit is confirmed, for that job
              only. Do not use it for anything else, and do not pass it on.
            </li>
          </ul>

          <h2>Reviews and content</h2>
          <p>
            Reviews may be published on a professional's public profile and cannot be edited
            once posted. We may remove content that is abusive, untrue, unlawful, or not the
            author's to post.
          </p>

          <h2>What we are responsible for</h2>
          <p>
            We are responsible for running the platform with reasonable care: checking that the
            professionals we introduce are approved for the trade, that agreements are recorded,
            and that stages are checked against photographs before they count as done.
          </p>
          <p>
            We are not the builder. The quality, timing and safety of the work are the
            responsibility of the professional you contract with. Where the law allows us to
            limit our liability, our liability to you is limited to the commission we earned on
            the job in question.
          </p>

          <h2>Accounts</h2>
          <p>
            Your mobile number is your account, and codes sent to it should not be shared. You
            may close your account at any time from the app or the website; what happens to your
            data then is described in our{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
          <p>
            We may suspend an account that is being used to defraud, harass, or misrepresent
            who is doing the work.
          </p>

          <h2>Changes</h2>
          <p>
            We will post any change to these terms on this page and update the date above.
            Continuing to use Decora Shine after a change means accepting it.
          </p>

          <h2>Law</h2>
          <p>
            These terms are governed by the laws of India, and the courts of Lucknow, Uttar
            Pradesh have jurisdiction over any dispute.
          </p>

          <h2>Contact</h2>
          <p>
            Intellihive Solutions, operator of Decora Shine.
            <br />
            <Link href="mailto:hello@decorashine.com">hello@decorashine.com</Link>
          </p>
        </div>
      </Container>
    </Section>
  );
}
