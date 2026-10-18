import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { formatDateOnly } from "@/lib/format";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/**
 * The three newest posts, read from `lib/blog/posts.ts`.
 *
 * This used to be a second, hand-typed copy of those three posts, and it had
 * already drifted from the real ones: different title casing, different
 * excerpts, and "6 min" against the post's own "5 min read" (LAND-12). One
 * declaration cannot disagree with itself.
 *
 * Post cards lost their 160px gradient cover blocks earlier. Those covers
 * carried no information, since the gradient was picked per post and the icon
 * inside it repeated the category badge printed directly underneath. Removing
 * them lets the headline lead, which is the only part a reader actually chooses
 * on.
 *
 * "All posts" sits under the lede, in the heading's right column, instead of
 * floating at the end of a flex row that left the heading short of its width.
 */
const PREVIEW_POSTS = [...BLOG_POSTS]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 3);

export function BlogPreviewSection() {
  return (
    <Section surface="base" labelledBy="blog-heading">
      <SectionHeading
        id="blog-heading"
        title="From the blog"
        lede="Tips and guides for running a service business."
        action={
          <Button asChild variant="outline" className="h-11 px-5 text-base">
            <Link href="/blog">
              All posts
              <IconArrowRight className="!size-4" />
            </Link>
          </Button>
        }
      />

      <div className="mt-12 grid gap-5 md:grid-cols-3 lg:mt-14 lg:gap-6">
        {PREVIEW_POSTS.map((post, i) => (
          <Reveal key={post.slug} delay={i * 90}>
            <Card className="group relative h-full transition-colors duration-200 hover:border-brand/40">
              <CardContent className="flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-center gap-2.5">
                  <Badge variant="secondary" className="text-xs">
                    {post.categoryLabel}
                  </Badge>
                  <span className="tnum text-sm text-muted-foreground">
                    {post.readTime}
                  </span>
                </div>

                <h3 className="mt-5 font-heading text-xl font-semibold leading-snug tracking-tight text-ink text-pretty">
                  {/* Stretched link — the whole card is the hit area, but only
                      the title is announced as the link. */}
                  <Link
                    href={`/blog/${post.slug}`}
                    className="after:absolute after:inset-0 group-hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {post.title}
                  </Link>
                </h3>

                <p className="mt-3 flex-1 text-base leading-relaxed text-muted-foreground text-pretty">
                  {post.excerpt}
                </p>

                <time
                  dateTime={post.date}
                  className="tnum mt-6 text-sm text-muted-foreground"
                >
                  {formatDateOnly(post.date)}
                </time>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
