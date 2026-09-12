import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container, Section } from "@repo/ui";

/**
 * The privacy policy, written to satisfy Google Play's User Data policy.
 *
 * Play checks for specific things, and a listing is rejected without them: the
 * developer's legal name, the app named explicitly, every type of data
 * accessed or collected, why, who it is shared with, how it is secured, how
 * long it is kept, and how somebody deletes their account. Each has its own
 * heading below rather than being implied in prose, because a reviewer scans
 * for them.
 *
 * Every claim is checkable against the code: the address rule is the one in
 * the lead module, the retention wording is what account closure does, and
 * "no advertising or analytics" is true because neither surface contains such
 * an SDK. It must also agree with the Data safety form in Play Console and
 * `RELEASE.md`; those three drifting apart is how a listing is pulled later.
 */
export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Decora Shine collects, why, who it is shared with, how long it is kept, and how to have it deleted.",
};

const UPDATED = "13 September 2026";

export default function PrivacyPage() {
  return (
    <Section tone="paper">
      <Container width="narrow" className="py-10 sm:py-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Privacy policy" }]} />

        <h1 className="mt-5 text-[32px] leading-tight sm:text-[40px]">Privacy policy</h1>
        <p className="mt-3 text-[14px] text-ink-3">Last updated {UPDATED}</p>

        <div className="prose-article mt-8">
          <p>
            This policy covers the <strong>Decora Shine</strong> mobile app and the website at
            decorashine.com, both operated by <strong>Intellihive Solutions</strong>, Faridabad,
            Haryana, India. It says what we collect, why, who else ever sees it, how long we keep
            it, and how to have it removed. It is written to be read rather than survived.
          </p>

          <h2>The short version</h2>
          <ul>
            <li>Your mobile number is your account. It is never shared with professionals.</li>
            <li>
              Your full address reaches one professional only after you confirm a site visit with
              them, and only for that job.
            </li>
            <li>
              There is no advertising, no tracking across other apps or websites, and no data sold
              to anybody.
            </li>
            <li>
              You can delete your account yourself, in the app or on the website. See{" "}
              <Link href="/delete-account">deleting your account</Link>.
            </li>
          </ul>

          <h2>What we collect, and why</h2>
          <p>
            <strong>Mobile number</strong> — required. It is your account: we send a one-time code
            to it instead of asking you to remember a password, and our coordinator calls it about
            your quotes. Used for account management and app functionality.
          </p>
          <p>
            <strong>Name</strong> — required. So a coordinator and the professionals quoting for
            you know who they are working for.
          </p>
          <p>
            <strong>District</strong> — required. Prices, availability and professionals are all
            organised by district, so without one we cannot show you anything meaningful.
          </p>
          <p>
            <strong>Email address</strong> — optional, and only if you choose to sign in with
            Google. Used to recognise you on your next visit.
          </p>
          <p>
            <strong>Address and photographs of the job</strong> — optional, and used to price the
            work. Photographs you attach to a requirement are shown to the professionals quoting
            it. The address is treated separately; see below.
          </p>
          <p>
            <strong>Messages</strong> — what you write to our coordinator about a job. Every
            conversation is between you and Decora Shine; you are never in a thread with a
            professional.
          </p>
          <p>
            <strong>Crash and diagnostic data</strong> — when the app stops unexpectedly, so we can
            fix it. These carry no name, number or address.
          </p>
          <p>
            <strong>If you are a professional</strong>, we additionally collect your business name,
            GST number where you have one, years in the trade, the districts you cover, and the
            identity and registration documents our team checks before approving you. Photographs
            of completed work that you post appear on your public profile.
          </p>

          <h2>Your address, specifically</h2>
          <p>
            When you submit a requirement we ask only for your locality. The full address is
            released to a professional once — and only once — you confirm a site visit with them,
            and only for the trade that visit is for. A professional who has not been confirmed for
            a visit cannot see it, and one confirmed for your painting cannot see it because of
            your carpentry.
          </p>

          <h2>Permissions the app asks for</h2>
          <p>
            Each is requested at the moment it is used, with a reason on screen, and never on first
            launch. Refusing one leaves the rest of the app working.
          </p>
          <ul>
            <li>
              <strong>Camera</strong> — when you tap Camera to photograph a room or, for
              professionals, completed work.
            </li>
            <li>
              <strong>Photos</strong> — when you tap Gallery to attach an existing photograph.
            </li>
            <li>
              <strong>Notifications</strong> — after you have a job worth being told about, for
              quotes, visits and messages.
            </li>
            <li>
              <strong>Location is never requested.</strong> There is no "near me" feature; you tell
              us your district and locality in words.
            </li>
          </ul>

          <h2>Who else sees your information</h2>
          <p>We do not sell your data, and we do not share it for advertising. It reaches:</p>
          <ul>
            <li>
              <strong>Professionals quoting your job</strong> — the job, your locality and the
              photographs you attached. Not your mobile number, and not your email.
            </li>
            <li>
              <strong>The professional you confirm a visit with</strong> — additionally your full
              address, for that job.
            </li>
            <li>
              <strong>Our messaging provider</strong> (MSG91, and through it WhatsApp/Meta) —
              your mobile number, to deliver sign-in codes and job updates.
            </li>
            <li>
              <strong>Our hosting and storage providers</strong> — who hold the data on our behalf,
              on servers in India, and may not use it for anything else.
            </li>
            <li>
              <strong>Google</strong> — if you choose Google sign-in, to verify who you are.
            </li>
            <li>
              <strong>Our error-reporting provider</strong> — crash reports with no personal detail
              attached.
            </li>
            <li>
              <strong>Authorities</strong> — only where the law requires it of us.
            </li>
          </ul>

          <h2>How it is kept safe</h2>
          <p>
            Data is encrypted in transit using HTTPS. Sign-in is by one-time code rather than a
            password, so there is no password of yours for us to lose, and codes are stored only as
            a cryptographic hash and expire within minutes. Access inside our team is limited to the
            people coordinating your job, and every staff account is protected by two-factor
            authentication.
          </p>

          <h2>How long we keep it</h2>
          <p>
            While your account is open, and then as follows. Closing your account removes your name,
            number, email and addresses, and frees your number for use again.
          </p>
          <ul>
            <li>Requirements, messages and photographs — removed within 30 days of closure.</li>
            <li>
              Agreements and invoices — kept for eight years in anonymised form, because Indian tax
              law requires financial records to remain available and because a professional is the
              other party to them.
            </li>
            <li>
              Reviews — kept, without your name, for as long as that professional's profile exists.
            </li>
            <li>Backups — cycled out within 90 days.</li>
          </ul>

          <h2>Deleting your account</h2>
          <p>
            In the app: <strong>Account → Close your account</strong>. On the website: your account
            page. Neither needs an email to us. Full instructions, including what to do if you
            cannot sign in, are on{" "}
            <Link href="/delete-account">the account deletion page</Link>.
          </p>

          <h2>Your rights</h2>
          <p>
            You may ask for a copy of what we hold about you, ask us to correct it, ask us to delete
            it, or object to a particular use. Write to{" "}
            <Link href="mailto:privacy@decorashine.com">privacy@decorashine.com</Link> and we will
            answer within 30 days. If our answer does not satisfy you, you may complain to the
            relevant data protection authority.
          </p>

          <h2>Children</h2>
          <p>
            Decora Shine is for adults arranging work on a property. It is not directed at children,
            we do not knowingly collect information from anybody under 18, and we delete such
            information if we discover it.
          </p>

          <h2>Changes</h2>
          <p>
            If this policy changes in a way that affects you, we will say so on this page and update
            the date at the top. Material changes are also notified in the app.
          </p>

          <h2>Contact</h2>
          <p>
            Intellihive Solutions, operator of Decora Shine
            <br />
            Faridabad, Haryana, India
            <br />
            <Link href="mailto:privacy@decorashine.com">privacy@decorashine.com</Link>
          </p>
        </div>
      </Container>
    </Section>
  );
}
