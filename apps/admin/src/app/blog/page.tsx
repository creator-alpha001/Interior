import { listBlogCategories, listDomains, listPosts } from "@repo/data";
import { Badge, formatDate } from "@repo/ui";
import { DataTable, FilterBar, FilterGroup, Metric, PageBody, PageHeader, Panel } from "@/components/ops-ui";

export const metadata = { title: "Blog" };

export default async function BlogAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; domain?: string }>;
}) {
  const sp = await searchParams;
  const [all, posts, categories, domains] = await Promise.all([
    listPosts(),
    listPosts({ categorySlug: sp.category, domainSlug: sp.domain }),
    listBlogCategories(),
    listDomains(),
  ]);

  const href = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...sp, ...patch })) {
      if (value && value !== "all") params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/blog?${qs}` : "/blog";
  };

  const totalMinutes = all.reduce((sum, p) => sum + p.post.readingMinutes, 0);

  return (
    <>
      <PageHeader
        title="Blog"
        subtitle="The marketing asset that has to rank. Every post carries its own SEO title and description."
      />

      <PageBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Published" value={all.length} hint={`${categories.length} categories`} />
          <Metric label="Featured" value={all.filter((p) => p.post.isFeatured).length} hint="Lead slot on the blog index" />
          <Metric
            label="Tied to a service"
            value={all.filter((p) => p.domain !== null).length}
            hint="Cross-links to that catalogue"
          />
          <Metric label="Reading time" value={`${totalMinutes} min`} hint="Across all posts" />
        </div>

        <FilterBar>
          <FilterGroup
            label="Category"
            current={sp.category ?? "all"}
            hrefFor={(value) => href({ category: value })}
            options={[
              { value: "all", label: "All", count: all.length },
              ...categories.map((c) => ({
                value: c.slug,
                label: c.name,
                count: all.filter((p) => p.category.id === c.id).length,
              })),
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

        <DataTable
          rows={posts}
          rowKey={(row) => row.post.id}
          empty="No posts match these filters."
          columns={[
            {
              key: "post",
              header: "Post",
              width: "38%",
              render: (row) => (
                <>
                  <div className="text-[13.5px] font-medium text-ink">{row.post.title}</div>
                  <div className="mt-0.5 line-clamp-1 text-[12px] text-ink-3">
                    {row.post.excerpt}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-ink-4">/blog/{row.post.slug}</div>
                </>
              ),
            },
            {
              key: "category",
              header: "Category",
              render: (row) => (
                <>
                  <Badge tone="neutral">{row.category.name}</Badge>
                  {row.domain ? (
                    <div className="mt-1">
                      <Badge tone="brand">{row.domain.name}</Badge>
                    </div>
                  ) : null}
                </>
              ),
            },
            {
              key: "author",
              header: "Author",
              render: (row) => (
                <>
                  <div className="text-[12.5px] text-ink-2">{row.post.authorName}</div>
                  <div className="text-[11.5px] text-ink-4">{row.post.authorRole}</div>
                </>
              ),
            },
            {
              key: "published",
              header: "Published",
              render: (row) => (
                <span className="text-[12.5px] text-ink-2">{formatDate(row.post.publishedAt)}</span>
              ),
            },
            {
              key: "read",
              header: "Read",
              align: "right",
              render: (row) => (
                <span className="tnum text-[12.5px] text-ink-3">{row.post.readingMinutes}m</span>
              ),
            },
            {
              key: "status",
              header: "Status",
              render: (row) => (
                <>
                  <Badge tone={row.post.status === "published" ? "positive" : "neutral"}>
                    {row.post.status}
                  </Badge>
                  {row.post.isFeatured ? (
                    <div className="mt-1">
                      <Badge tone="clay">Featured</Badge>
                    </div>
                  ) : null}
                </>
              ),
            },
          ]}
        />

        <Panel title="SEO check">
          <ul className="space-y-1.5">
            {posts.map((row) => {
              const titleLength = row.post.seoTitle.length;
              const descLength = row.post.seoDescription.length;
              const titleOk = titleLength >= 30 && titleLength <= 65;
              const descOk = descLength >= 70 && descLength <= 165;
              return (
                <li
                  key={row.post.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-1.5 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-2">
                    {row.post.title}
                  </span>
                  <div className="flex gap-1.5">
                    <Badge tone={titleOk ? "positive" : "warning"}>title {titleLength}</Badge>
                    <Badge tone={descOk ? "positive" : "warning"}>desc {descLength}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-ink-4">
            Titles read best between 30 and 65 characters, descriptions between 70 and 165 — beyond
            that Google truncates them and the promise you made in the snippet gets cut off.
          </p>
        </Panel>
      </PageBody>
    </>
  );
}
