import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs, Container, Section } from "@repo/ui";

/**
 * How to delete a Decora Shine account.
 *
 * A Play requirement with a specific shape: any app that lets people create an
 * account must offer a **publicly reachable web page** — no sign-in, no app
 * install — that explains how to delete the account and what happens to the
 * data afterwards. Its URL is submitted in Play Console under Data safety, and
 * a listing without it is rejected.
 *
 * Deliberately its own page rather than a section of the privacy policy, so
 * the URL points at instructions rather than at a document to scroll.
 */
export const metadata: Metadata = {
  title: "Delete your account",
  description:
    "How to delete your Decora Shine account and what happens to your data, in the app, on the website, or by email.",
};

export default function DeleteAccountPage() {
  return (
    <Section tone="paper">
      <Container width="narrow" className="py-10 sm:py-14">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Delete your account" }]} />

        <h1 className="mt-5 text-[32px] leading-tight sm:text-[40px]">Delete your account</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
          You can close your Decora Shine account yourself, at any time. No email to us is needed,
          and you do not have to give a reason.
        </p>

        <div className="prose-article mt-8">
          <h2>In the app</h2>
          <ol>
            <li>Open the Decora Shine app and sign in.</li>
            <li>
              Go to <strong>Account</strong>, then <strong>Close your account</strong>.
            </li>
            <li>Read what is removed and what is kept, then confirm.</li>
          </ol>

          <h2>On the website</h2>
          <ol>
            <li>
              Sign in at <Link href="/login">decorashine.com/login</Link>.
            </li>
            <li>
              Open your <Link href="/account">account page</Link> and choose{" "}
              <strong>Close your account</strong>.
            </li>
          </ol>

          <h2>By email</h2>
          <p>
            If you cannot sign in — a lost number, for instance — write to{" "}
            <Link href="mailto:privacy@decorashine.com">privacy@decorashine.com</Link> from the
            address on your account, or from any address quoting the mobile number you used. We
            answer within 30 days, usually sooner.
          </p>

          <h2>What is deleted</h2>
          <p>
            Your name, mobile number, email address and any addresses you gave us are removed, and
            your mobile number is freed for use again. Photographs you uploaded with a requirement
            are deleted with it. Messages between you and our coordinator are deleted.
          </p>

          <h2>What is kept, and why</h2>
          <p>
            Agreements, invoices and reviews are retained. Each of those has a professional on the
            other side of it who did not ask for their commercial records to be destroyed, and
            invoices are financial records we are required to keep. <strong>What is kept no longer
            carries your name, your number or your address.</strong>
          </p>
          <p>
            Retention: anonymised agreements and invoices are kept for eight years, which is the
            period Indian tax law requires financial records to be available for. Reviews are kept
            for as long as the professional's profile exists. Everything else is removed within 30
            days of your request, and backups that may still hold it are cycled out within 90 days.
          </p>

          <h2>Deleting the app is not the same thing</h2>
          <p>
            Uninstalling removes the app from your phone and nothing else. Your account stays open
            until you close it using one of the routes above.
          </p>

          <p>
            The full picture of what we hold and why is in our{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
        </div>
      </Container>
    </Section>
  );
}
