import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container, Section } from "@repo/ui";

/**
 * The privacy policy.
 *
 * Written from what the platform actually does rather than from a template:
 * every claim here is checkable against the code — the address release rule is
 * in the lead module, the retention rule is what account closure does, and the
 * "no advertising or analytics" line is true because there is no such SDK in
 * either the site or the app.
 *
 * Both app stores refuse a listing without a reachable policy, and the Play
 * Data Safety form has to agree with this page word for word. `RELEASE.md`
 * holds the table those answers come from.
 */
export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Decora Shine collects, why, who it is shared with, how long it is kept, and how to have it removed.",
};

const UPDATED = "12 September 2026";

export default function PrivacyPage() {
  return (
    <Section tone="paper">
      <Container width="narrow" className="py-10 sm:py-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Privacy policy" }]} />

        <h1 className="mt-5 text-[32px] leading-tight sm:text-[40px]">Privacy policy</h1>
        <p className="mt-3 text-[14px] text-ink-3">Last updated {UPDATED}</p>

        <div className="prose-article mt-8">
          <p>
            Decora Shine is operated by Intellihive Solutions. This page says what we collect
            when you use decorashine.com or the Decora Shine app, why we collect it, who else
            ever sees it, and how to have it removed. It is written to be read, not to be
            survived.
          </p>

          <h2>What we collect, and why</h2>
          <p>
            <strong>Your mobile number.</strong> It is your account — we send a one-time code
            to it instead of asking you to remember a password, and our coordinator calls it
            about your quotes. It is never shared with professionals.
          </p>
          <p>
            <strong>Your name and city.</strong> So a coordinator and the professionals quoting
            for you know who they are working for, and so prices and availability match where
            you live.
          </p>
          <p>
            <strong>Your email address</strong>, only if you sign in with Google. We use it to
            recognise you on your next visit.
          </p>
          <p>
            <strong>What you tell us about the job</strong>, including photographs of the room
            and the address. The address is the sensitive one, and it is treated that way — see
            below.
          </p>
          <p>
            <strong>Messages</strong> you send us about a job. Every conversation is between
            you and Decora Shine; you are never in a thread with a professional.
          </p>
          <p>
            <strong>Crash reports</strong>, if the app stops unexpectedly. These carry no name,
            number or address.
          </p>

          <h2>Your address, specifically</h2>
          <p>
            When you submit a requirement we ask only for your locality. The full address is
            released to a professional once — and only once — you confirm a site visit with
            that professional, and only for the service that visit is for. A professional who
            has not been confirmed for a visit cannot see it, and one confirmed for your
            painting cannot see it because of your carpentry.
          </p>

          <h2>Who else sees your information</h2>
          <ul>
            <li>
              <strong>Professionals quoting your job</strong> see what the job is, your
              locality, and the photographs you attached — enough to price the work. They do
              not see your mobile number or your email.
            </li>
            <li>
              <strong>Companies that carry things for us.</strong> Our messaging provider sends
              your sign-in codes and job updates by WhatsApp and SMS; our hosting and storage
              providers hold the data on our behalf, in India; our error reporting service
              receives crash reports with no personal detail attached.
            </li>
            <li>
              <strong>Nobody else.</strong> We do not sell your information, we do not share it
              for advertising, and there is no advertising, attribution or third-party
              analytics software in the site or the app.
            </li>
          </ul>

          <h2>What we do not do</h2>
          <p>
            We do not track you across other apps or websites. We do not ask for your location.
            We do not build advertising profiles. The app asks for the camera when you tap
            Camera, for photos when you tap Gallery, and for notifications after you have a job
            worth being told about — never on first launch, and each with a reason on screen.
          </p>

          <h2>How long we keep it</h2>
          <p>
            For as long as your account is open, and then as described below. You can close
            your account at any time — in the app under <strong>Account → Close your account</strong>,
            or on the website under your account page. No email to us is required.
          </p>
          <p>
            Closing your account removes your name, number, email and addresses, and frees your
            number for use again. Agreements, invoices and reviews are kept, because each of
            them has a professional on the other side who did not ask for their commercial
            records to be destroyed. What is kept no longer carries your name or your number.
          </p>

          <h2>Your rights</h2>
          <p>
            You can ask us for a copy of what we hold about you, ask us to correct it, or ask
            us to delete it. Write to{" "}
            <Link href="mailto:privacy@decorashine.com">privacy@decorashine.com</Link> and we
            will answer within 30 days. If you are unhappy with our answer you may complain to
            the relevant data protection authority.
          </p>

          <h2>Children</h2>
          <p>
            Decora Shine is for adults arranging work on a property. It is not directed at
            children, and we do not knowingly collect information from anybody under 18.
          </p>

          <h2>Security</h2>
          <p>
            Data is encrypted in transit. Sign-in is by one-time code rather than a password,
            so there is no password of yours for us to lose. Access to customer data inside our
            team is limited to the people coordinating your job.
          </p>

          <h2>Changes</h2>
          <p>
            If this policy changes in a way that affects you, we will say so on this page and
            update the date at the top.
          </p>

          <h2>Contact</h2>
          <p>
            Intellihive Solutions, operator of Decora Shine.
            <br />
            <Link href="mailto:privacy@decorashine.com">privacy@decorashine.com</Link>
          </p>
        </div>
      </Container>
    </Section>
  );
}
