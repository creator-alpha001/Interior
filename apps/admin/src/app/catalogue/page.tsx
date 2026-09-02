import Link from "next/link";
import {
  collectAll,
  formatRupees,
  listCategories,
  listDomains,
  listPackages,
  listProducts,
  priceUnitLabel,
} from "@repo/data";
import { Badge } from "@repo/ui";
import { DataTable, FilterBar, FilterGroup, Metric, PageBody, PageHeader, Panel } from "@/components/ops-ui";

export const metadata = { title: "Catalogue" };

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; tab?: string }>;
}) {
  const sp = await searchParams;
  const tab = sp.tab === "packages" ? "packages" : "products";

  const [domains, allProducts, allPackages, productPage, packages, categories] = await Promise.all([
    listDomains(),
    collectAll((cursor) => listProducts({ cursor })),
    listPackages(),
    listProducts({ domainSlug: sp.domain, limit: 100 }),
    listPackages(sp.domain),
    listCategories(sp.domain),
  ]);
  const products = productPage.items;

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...sp, ...patch })) {
      if (value && value !== "all") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/catalogue?${qs}` : "/catalogue";
  };

  return (
    <>
      <PageHeader
        title="Catalogue"
        subtitle="What customers browse and select. Every item is made to order — prices here are indicative starting rates."
      />

      <PageBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Products" value={allProducts.length} hint={`${categories.length} categories`} />
          <Metric label="Packages" value={allPackages.length} hint="Fixed-scope bundles" />
          <Metric
            label="Featured"
            value={allProducts.filter((p) => p.product.isFeatured).length}
            hint="Shown on the home page"
          />
          <Metric
            label="Bestsellers"
            value={allProducts.filter((p) => p.product.tags.includes("bestseller")).length}
            hint="Badged in the catalogue"
          />
        </div>

        <FilterBar>
          <FilterGroup
            label="View"
            current={tab}
            hrefFor={(value) => href({ tab: value === "products" ? undefined : value })}
            options={[
              { value: "products", label: "Products", count: allProducts.length },
              { value: "packages", label: "Packages", count: allPackages.length },
            ]}
          />
          <FilterGroup
            label="Service"
            current={sp.domain ?? "all"}
            hrefFor={(value) => href({ domain: value })}
            options={[
              { value: "all", label: "All" },
              ...domains.map((d) => ({ value: d.slug, label: d.name })),
            ]}
          />
        </FilterBar>

        {tab === "products" ? (
          <DataTable
            rows={products}
            rowKey={(row) => row.product.id}
            empty="No products for this service yet."
            columns={[
              {
                key: "product",
                header: "Product",
                width: "30%",
                render: (row) => (
                  <>
                    <div className="text-[13.5px] font-medium text-ink">{row.product.name}</div>
                    <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-3">
                      {row.product.shortDescription}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.product.tags.map((tag) => (
                        <Badge key={tag} tone={tag === "bestseller" ? "clay" : "neutral"}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </>
                ),
              },
              {
                key: "domain",
                header: "Service",
                render: (row) => (
                  <>
                    <div className="text-[12.5px] text-ink-2">{row.domain.name}</div>
                    <div className="text-[11.5px] text-ink-4">{row.category.name}</div>
                  </>
                ),
              },
              {
                key: "price",
                header: "From",
                align: "right",
                render: (row) => (
                  <>
                    <div className="tnum text-[13px] font-medium text-ink">
                      {formatRupees(row.effectivePrice)}
                    </div>
                    <div className="text-[11px] text-ink-4">
                      {priceUnitLabel[row.product.priceUnit]}
                    </div>
                  </>
                ),
              },
              {
                key: "lead",
                header: "Lead time",
                align: "right",
                render: (row) => (
                  <span className="tnum text-[12.5px] text-ink-2">
                    {row.product.leadTimeDays}d
                  </span>
                ),
              },
              {
                key: "options",
                header: "Options",
                align: "right",
                render: (row) => (
                  <span className="tnum text-[12.5px] text-ink-3">
                    {row.product.options.length}
                  </span>
                ),
              },
              {
                key: "rating",
                header: "Rating",
                align: "right",
                render: (row) => (
                  <span className="tnum text-[12.5px] text-ink-2">
                    {row.product.rating.toFixed(1)} ({row.product.ratingCount})
                  </span>
                ),
              },
              {
                key: "live",
                header: "Live",
                render: (row) => (
                  <Badge tone={row.product.isActive ? "positive" : "neutral"}>
                    {row.product.isActive ? "Live" : "Hidden"}
                  </Badge>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={packages}
            rowKey={(row) => row.servicePackage.id}
            empty="No packages for this service yet."
            columns={[
              {
                key: "package",
                header: "Package",
                width: "30%",
                render: (row) => (
                  <>
                    <div className="text-[13.5px] font-medium text-ink">
                      {row.servicePackage.name}
                    </div>
                    <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-3">
                      {row.servicePackage.shortDescription}
                    </div>
                    {row.servicePackage.badge ? (
                      <Badge tone="clay" className="mt-1">
                        {row.servicePackage.badge}
                      </Badge>
                    ) : null}
                  </>
                ),
              },
              {
                key: "domain",
                header: "Service",
                render: (row) => <span className="text-[12.5px] text-ink-2">{row.domain.name}</span>,
              },
              {
                key: "price",
                header: "Price",
                align: "right",
                render: (row) => (
                  <>
                    <div className="tnum text-[13px] font-medium text-ink">
                      {formatRupees(row.servicePackage.price)}
                    </div>
                    <div className="text-[11px] text-ink-4">{row.servicePackage.priceBasis}</div>
                  </>
                ),
              },
              {
                key: "scope",
                header: "Scope",
                align: "right",
                render: (row) => (
                  <span className="tnum text-[12.5px] text-ink-2">
                    {row.servicePackage.inclusions.length} in / {row.servicePackage.exclusions.length} out
                  </span>
                ),
              },
              {
                key: "items",
                header: "Line items",
                align: "right",
                render: (row) => <span className="tnum text-[12.5px] text-ink-3">{row.items.length}</span>,
              },
              {
                key: "duration",
                header: "Duration",
                align: "right",
                render: (row) => (
                  <span className="tnum text-[12.5px] text-ink-2">
                    {row.servicePackage.durationDays}d
                  </span>
                ),
              },
            ]}
          />
        )}

        <Panel title="Categories">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <Badge key={category.id} tone="neutral">
                {category.name}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">
            Categories belong to a service. Creating a new trade in{" "}
            <Link href="/domains" className="text-brand">
              Domains
            </Link>{" "}
            lets you add categories and items under it without any engineering work.
          </p>
        </Panel>
      </PageBody>
    </>
  );
}
