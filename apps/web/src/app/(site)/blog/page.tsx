import type { Metadata } from "next";
import Link from "next/link";
import { listBlogCategories, listBlogTags, listPosts } from "@repo/data";
import { PostCard } from "@/components/cards";
import {
  Breadcrumbs,
  Container,
  EmptyState,
  Section,
} from "@repo/ui";
import { cn } from "@repo/ui";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Buying guides, cost breakdowns and maintenance advice for interiors, furniture, fabrication and painting — written by the professionals on the platform.",
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string }>;
}) {
  const { category, tag } = await searchParams;
  const [posts, categories, tags] = await Promise.all([
    listPosts({ categorySlug: category, tagSlug: tag }),
    listBlogCategories(),
    listBlogTags(),
  ]);

  const [lead, ...rest] = posts;
  const isFiltered = Boolean(category || tag);

  return (
    <>
      <div className="border-b border-line bg-surface">
        <Container width="wide" className="py-10">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />
          <h1 className="mt-4 max-w-3xl text-[36px] leading-tight sm:text-[44px]">
            Know what you are buying
          </h1>
          <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-ink-2">
            Written by the designers, carpenters, fabricators and painters who work on this
            platform. What things actually cost, which materials are worth paying for, and where
            quotes quietly differ.
          </p>
        </Container>
      </div>

      <Section tone="paper">
        <Container width="wide">
          <div className="mb-8 flex flex-wrap items-center gap-2 border-b border-line pb-6">
            <Link
              href="/blog"
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                !isFiltered
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink-2 hover:border-ink-4",
              )}
            >
              All posts
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/blog?category=${c.slug}`}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[14px] sm:text-[13px] transition-colors",
                  category === c.slug
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface text-ink-2 hover:border-ink-4",
                )}
              >
                {c.name}
              </Link>
            ))}
            <span className="mx-2 hidden h-4 w-px bg-line sm:block" />
            {tags.slice(0, 5).map((t) => (
              <Link
                key={t.id}
                href={`/blog?tag=${t.slug}`}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[13.5px] sm:text-[12.5px] transition-colors",
                  tag === t.slug ? "bg-clay-soft font-medium text-clay" : "text-ink-3 hover:text-ink",
                )}
              >
                #{t.name}
              </Link>
            ))}
          </div>

          {posts.length === 0 ? (
            <EmptyState
              title="No posts here yet"
              description="Nothing published under this filter. Try another category."
            />
          ) : (
            <div className="space-y-10">
              {!isFiltered && lead ? (
                <PostCard view={lead} featured className="lg:grid lg:grid-cols-2 lg:gap-0" />
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {(isFiltered ? posts : rest).map((p) => (
                  <PostCard key={p.post.id} view={p} />
                ))}
              </div>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
