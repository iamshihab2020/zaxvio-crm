import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IconArrowLeft } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BLOG_POSTS, getPostBySlug, getRelatedPosts } from "@/lib/blog/posts";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post Not Found" };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
    },
  };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  const relatedPosts = getRelatedPosts(slug, 3);

  // Convert markdown-like content to simple HTML paragraphs
  const contentSections = post.content.split("\n\n").map((block, i) => {
    if (block.startsWith("### ")) {
      return (
        <h3
          key={i}
          className="mt-8 font-heading text-lg font-semibold text-ink"
        >
          {block.replace("### ", "")}
        </h3>
      );
    }
    if (block.startsWith("## ")) {
      return (
        <h2
          key={i}
          className="mt-10 font-heading text-xl font-bold text-ink"
        >
          {block.replace("## ", "")}
        </h2>
      );
    }
    if (block.startsWith("- ") || block.startsWith("1. ")) {
      const items = block.split("\n");
      return (
        <ul key={i} className="mt-4 list-disc space-y-1 pl-6 text-ink/80">
          {items.map((item, j) => (
            <li key={j}>
              {item
                .replace(/^[-\d]+\.\s*/, "")
                .replace(/\*\*(.*?)\*\*/g, "$1")}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mt-4 leading-relaxed text-ink/80">
        {block.replace(/\*\*(.*?)\*\*/g, "$1")}
      </p>
    );
  });

  return (
    <div className="bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        {/* Back link */}
        <Button asChild variant="ghost" size="sm" className="mb-8 gap-1.5">
          <Link href="/blog">
            <IconArrowLeft size={16} stroke={2} />
            Back to Blog
          </Link>
        </Button>

        {/* Post header */}
        <Badge variant="secondary" className="mb-4">
          {post.categoryLabel}
        </Badge>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {post.title}
        </h1>
        <div className="mt-4 flex items-center gap-2 text-sm text-ink/50">
          <span>Zaxvio Team</span>
          <span>&middot;</span>
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>&middot;</span>
          <span>{post.readTime}</span>
        </div>

        {/* Cover gradient */}
        <div
          className={`mt-8 h-48 rounded-xl bg-gradient-to-br sm:h-64 ${post.coverGradient}`}
          aria-hidden="true"
        />

        {/* Article content */}
        <article className="mt-10 font-body text-base leading-relaxed">
          {contentSections}
        </article>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <div className="mt-16 border-t border-border pt-12">
            <h2 className="font-heading text-xl font-bold text-ink">
              Related Posts
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {relatedPosts.map((related) => (
                <Link
                  key={related.slug}
                  href={`/blog/${related.slug}`}
                  className="group block"
                >
                  <Card className="h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-md">
                    <div
                      className={`h-28 bg-gradient-to-br ${related.coverGradient}`}
                      aria-hidden="true"
                    />
                    <CardContent className="p-4">
                      <h3 className="font-heading text-sm font-semibold text-ink line-clamp-2 group-hover:text-brand transition-colors">
                        {related.title}
                      </h3>
                      <p className="mt-1 text-xs text-ink/40">
                        {related.readTime}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
