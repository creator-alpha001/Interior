import type { Metadata } from "next";
import Link from "next/link";
import { listDomains, listPackages } from "@repo/data";
import { PackageCard } from "@/components/cards";
import {
  Breadcrumbs,
  Container,
  EmptyState,
  Section,
} from "@repo/ui";
import { cn } from "@repo/ui";

export const metadata: Metadata = {
  title: "Packages",
  description:
    "Fixed-scope packages across interiors, furniture, fabrication and painting — with inclusions and exclusions written down, not implied.",
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain: domainSlug } = await searchParams;
  const [domains, packages] = await Promise.all([listDomains(), listPackages(domainSlug)]);

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Packages" }]} />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[44px]">
            Fixed scopes, honest exclusions
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            The most common way a quote misleads is by leaving things out. Every package here lists
            what it does <em>not</em> cover as prominently as what it does — so when three
            professionals quote against it, you are comparing the same job.
          </p>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <Link
              href="/packages"
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                !domainSlug
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-2 hover:border-ink-4",
              )}
            >
              All services
            </Link>
            {domains.map((d) => (
              <Link
                key={d.id}
                href={`/packages?domain=${d.slug}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                  domainSlug === d.slug
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-2 hover:border-ink-4",
                )}
              >
                {d.name}
              </Link>
            ))}
          </div>

          {packages.length === 0 ? (
            <EmptyState
              title="No packages here yet"
              description="We have not published packages for this service. Submit a requirement and professionals will quote against your scope directly."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((pkg) => (
                <PackageCard key={pkg.servicePackage.id} view={pkg} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
