import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { getPostBySlug, listRelatedPosts } from "@repo/data";
import { PostCard } from "@/components/cards";
import {
  Badge,
  Breadcrumbs,
  ButtonLink,
  Container,
  Section,
  SectionHeading,
} from "@repo/ui";
import { Media } from "@repo/ui";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const view = await getPostBySlug(slug);
  if (!view) return { title: "Not found" };
  return {
    title: view.post.seoTitle,
    description: view.post.seoDescription,
    openGraph: {
      title: view.post.title,
      description: view.post.excerpt,
      type: "article",
      publishedTime: view.post.publishedAt ?? undefined,
    },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const view = await getPostBySlug(slug);
  if (!view) notFound();

  const { post, category, tags, domain } = view;
  const related = await listRelatedPosts(post.id, 3);
  const html = await marked.parse(post.body);

  const published = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <>
      <Container width="default" className="py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blog" },
            { label: category.name, href: `/blog?category=${category.slug}` },
            { label: post.title },
          ]}
        />
      </Container>

      <article>
        <Container width="narrow">
          <header>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="clay">{category.name}</Badge>
              {domain ? <Badge tone="brand">{domain.name}</Badge> : null}
            </div>
            <h1 className="mt-5 text-[38px] leading-[1.1] sm:text-[46px]">{post.title}</h1>
            <p className="mt-5 text-[18px] leading-relaxed text-ink-3">{post.excerpt}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-5 text-[14px] sm:text-[13px] text-ink-3">
              <span className="font-medium text-ink">{post.authorName}</span>
              <span>·</span>
              <span>{post.authorRole}</span>
              <span>·</span>
              <span>{published}</span>
              <span>·</span>
              <span>{post.readingMinutes} min read</span>
            </div>
          </header>
        </Container>

        <Container width="default" className="mt-8">
          <div className="aspect-[21/9] overflow-hidden rounded-xl">
            <Media src={post.coverImageUrl} alt={post.title} rounded={false} />
          </div>
        </Container>

        <Container width="narrow" className="py-12">
          <div className="prose-article" dangerouslySetInnerHTML={{ __html: html }} />

          <div className="mt-12 flex flex-wrap gap-2 border-t border-line pt-6">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-[13.5px] sm:text-[12.5px] text-ink-3"
              >
                #{t}
              </span>
            ))}
          </div>

          {domain ? (
            <div className="mt-10 overflow-hidden rounded-xl border border-line bg-surface">
              <div className="p-6">
                <p className="text-[12px] sm:text-[11px] font-semibold uppercase tracking-[0.14em] text-clay">
                  Ready to act on this?
                </p>
                <h2 className="mt-2 font-display text-[24px]">
                  Get three {domain.name.toLowerCase()} quotes, free
                </h2>
                <p className="mt-2 text-[15px] sm:text-[14px] leading-relaxed text-ink-3">
                  Verified professionals in your city visit, measure, and send a written quote you
                  can compare side by side.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <ButtonLink href={`/submit-requirement?domain=${domain.slug}`}>
                    Get free quotes
                  </ButtonLink>
                  <ButtonLink href={`/catalogue/${domain.slug}`} variant="secondary">
                    Browse {domain.name}
                  </ButtonLink>
                </div>
              </div>
            </div>
          ) : null}
        </Container>
      </article>

      {related.length > 0 ? (
        <Section tone="surface">
          <Container width="wide">
            <SectionHeading
              eyebrow="Keep reading"
              title="Related guides"
              action={
                <Link href="/blog" className="text-[14.5px] sm:text-[13.5px] font-medium text-brand">
                  All posts →
                </Link>
              }
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.post.id} view={p} />
              ))}
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
