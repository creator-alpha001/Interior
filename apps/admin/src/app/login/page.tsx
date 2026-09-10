import { redirect } from "next/navigation";
import { getActor } from "@repo/data";
import { StaffLoginForm } from "@/components/staff-login-form";

export const metadata = { title: "Sign in" };

/**
 * Reads a cookie, so it can never be cached into somebody else's page.
 */
export const dynamic = "force-dynamic";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ wrong_role?: string }>;
}) {
  const [{ wrong_role: wrongRole }, actor] = await Promise.all([searchParams, getActor()]);

  // Already staff: nothing to sign in to. Sent on rather than shown a form
  // that would only redirect them back.
  if (actor?.role === "admin" || actor?.role === "sales_agent") redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <StaffLoginForm wrongRole={wrongRole === "1"} />
    </main>
  );
}
