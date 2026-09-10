import { getDomainUsage, listDomains } from "@repo/data";
import { DomainManager, type DomainUsage } from "@/components/domain-manager";
import { PageBody, PageHeader } from "@/components/ops-ui";

export const metadata = { title: "Domains" };

export default async function DomainsPage() {
  const domains = await listDomains();
  const usageEntries = await Promise.all(
    domains.map(async (d) => [d.id, await getDomainUsage(d.id)] as const),
  );
  const usage = Object.fromEntries(usageEntries) as Record<string, DomainUsage>;

  return (
    <>
      <PageHeader
        title="Domains"
        subtitle="The trades the platform serves. Adding one is configuration, not a release."
      />

      <PageBody className="space-y-4">
        <div className="rounded-lg border border-brand-line bg-brand-soft p-4">
          <h2 className="text-[13px] font-semibold text-brand">Why this screen exists</h2>
          <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-2">
            Nothing in the platform is hardcoded to interiors, furniture, fabrication or painting.
            Leads, quotes, agreements, projects, invoices and reports all read a domain id, so a
            trade created here works everywhere the moment it is saved — vendors can be approved for
            it, customers can select it on the requirement form, and it appears in reporting on its
            own line.
          </p>
        </div>

        <DomainManager domains={domains} usage={usage} />
      </PageBody>
    </>
  );
}
