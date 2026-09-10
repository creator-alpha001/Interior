import { redirect } from "next/navigation";
import { getActor, getSessionUser } from "@repo/data";
import { OpsShell } from "@/components/ops-shell";

/**
 * The gate on the whole ops panel.
 *
 * Every screen below this shows things no customer or vendor may ever see —
 * customer phone numbers, vendor margins, commission owed, and the notes an
 * agent wrote after a call. Until now the panel had no sign-in at all: it read
 * the seeded store and rendered as a stand-in admin, which was fine while there
 * was no backend and is exactly wrong now that there is one.
 *
 * The role check is not decoration. A customer or a vendor who reaches this URL
 * with a perfectly valid session of their own is still not staff, and the API
 * would refuse every call behind this page anyway — so refuse here, once, with
 * somewhere to go, rather than rendering a panel of failed requests.
 */
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  if (!actor) redirect("/login");
  if (actor.role !== "admin" && actor.role !== "sales_agent") {
    redirect("/login?wrong_role=1");
  }

  const person = await getSessionUser();

  return (
    <OpsShell staff={{ name: person?.name ?? "Staff", role: actor.role }}>{children}</OpsShell>
  );
}
