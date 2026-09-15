import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@repo/data";
import { Container } from "@repo/ui";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export const metadata: Metadata = {
  title: "Create your password",
  robots: { index: false, follow: false },
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, { next }] = await Promise.all([getSessionUser(), searchParams]);
  if (!session) redirect("/login");

  const destination = safeDestination(session.actor.role, next);
  if (session.passwordSet) redirect(destination);

  return (
    <div className="bg-paper">
      <Container width="default" className="py-14 sm:py-20">
        <div className="mx-auto max-w-lg">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-clay sm:text-[11px]">
            Mobile verified
          </p>
          <h1 className="mt-3 text-[30px] leading-tight sm:text-[36px]">Create your password</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
            Your number is confirmed. Set a password now so future sign-ins do not require a
            one-time code.
          </p>
          <div className="mt-8">
            <SetPasswordForm next={destination} />
          </div>
        </div>
      </Container>
    </div>
  );
}

function safeDestination(role: string, next?: string): string {
  const area = role === "professional" ? "/partner" : "/account";
  if (next?.startsWith(area) && !next.startsWith("//")) return next;
  return area;
}
