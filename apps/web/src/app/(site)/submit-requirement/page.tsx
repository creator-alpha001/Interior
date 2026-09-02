import type { Metadata } from "next";
import {
  getPackageBySlug,
  getProductBySlug,
  getProfessional,
  listCities,
  listDomains,
} from "@repo/data";
import { RequirementForm } from "@/components/requirement/requirement-form";
import { Container } from "@repo/ui";

export const metadata: Metadata = {
  title: "Get free quotes",
  description:
    "Tell us what you need in two minutes. We assign three verified professionals per service and you compare their quotes side by side.",
};

const steps: Array<[string, string]> = [
  ["We call to confirm", "A quick call to understand the detail the form deliberately leaves out."],
  ["Three professionals assigned", "Per service you selected, in your city, all confirmed available."],
  ["Site visits and quotes", "Each one measures on site and uploads a written quote."],
  ["You compare and choose", "Side by side, one table per service. No pressure."],
];

function StepList({ className }: { className?: string }) {
  return (
    <ol className={className}>
      <li className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-4 lg:hidden">
        What happens next
      </li>
      {steps.map(([title, body], i) => (
        <li key={title} className="mb-5 flex gap-4 last:mb-0">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-[13.5px] font-semibold text-brand sm:text-[12.5px]">
            {i + 1}
          </span>
          <div>
            <div className="text-[15px] font-medium text-ink sm:text-[14px]">{title}</div>
            <div className="mt-0.5 text-[14px] leading-relaxed text-ink-3 sm:text-[13px]">{body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default async function SubmitRequirementPage({
  searchParams,
}: {
  searchParams: Promise<{
    domain?: string;
    product?: string;
    package?: string;
    qty?: string;
    opts?: string;
    pro?: string;
  }>;
}) {
  const sp = await searchParams;
  const [domains, cities] = await Promise.all([listDomains(), listCities()]);

  const productView = sp.product ? await getProductBySlug(sp.product) : null;
  const packageView = sp.package ? await getPackageBySlug(sp.package) : null;
  const requestedPro = sp.pro ? await getProfessional(sp.pro) : null;

  const selectedOptions = Object.fromEntries(
    (sp.opts ?? "")
      .split("|")
      .filter(Boolean)
      .map((pair) => {
        const [k, ...rest] = pair.split(":");
        return [k, rest.join(":")];
      }),
  );

  const prefill = productView
    ? {
        domainId: productView.domain.id,
        item: {
          domainId: productView.domain.id,
          productId: productView.product.id,
          itemName: productView.product.name,
          quantity: Number(sp.qty ?? 1) || 1,
          selectedOptions,
          indicativePrice: productView.effectivePrice,
          label: productView.product.name,
          sublabel: productView.domain.name,
        },
      }
    : packageView
      ? {
          domainId: packageView.domain.id,
          item: {
            domainId: packageView.domain.id,
            packageId: packageView.servicePackage.id,
            itemName: packageView.servicePackage.name,
            quantity: 1,
            selectedOptions: {},
            indicativePrice: packageView.servicePackage.price,
            label: packageView.servicePackage.name,
            sublabel: `${packageView.domain.name} package`,
          },
        }
      : sp.domain
        ? { domainId: domains.find((d) => d.slug === sp.domain)?.id, item: null }
        : null;

  return (
    <div className="bg-paper">
      <Container width="wide" className="py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
              Free · no obligation
            </p>
            <h1 className="mt-3 text-[34px] leading-tight sm:text-[42px]">
              Tell us what you need
            </h1>
            <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-ink-2">
              Two minutes, six questions. Whether you want one dining table or a full renovation
              across three trades, this is the same short form — we do the detailed scoping on a
              call, not in a dropdown.
            </p>

            <StepList className="mt-8 hidden border-t border-line pt-8 lg:block" />
          </div>

          <RequirementForm
            domains={domains}
            cities={cities}
            prefill={prefill}
            requestedProfessional={
              requestedPro
                ? {
                    id: requestedPro.id,
                    name: requestedPro.name,
                    companyName: requestedPro.companyName,
                    domainIds: requestedPro.domains.map((d) => d.id),
                    domainNames: requestedPro.domains.map((d) => d.name),
                  }
                : null
            }
          />

          <StepList className="border-t border-line pt-8 lg:hidden" />
        </div>
      </Container>
    </div>
  );
}
