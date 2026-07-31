import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const PREVIEW_POSTS = [
  {
    slug: "streamline-service-business-operations",
    title: "5 ways to streamline your service business operations",
    excerpt:
      "From digital scheduling to automated invoicing — how busy service businesses win back hours every week.",
    category: "Business tips",
    date: "Mar 28, 2026",
    readingTime: "6 min",
  },
  {
    slug: "complete-guide-digital-invoicing",
    title: "The complete guide to digital invoicing for field service",
    excerpt:
      "Stop chasing payments. How field service pros use on-site invoicing to get paid the same day.",
    category: "Guides",
    date: "Mar 22, 2026",
    readingTime: "9 min",
  },
  {
    slug: "paper-to-digital-service-businesses",
    title: "Why service businesses are switching from paper to digital",
    excerpt:
      "The clipboard-and-carbon-copy era is ending. Why the switch is happening, and how to make it.",
    category: "Industry",
    date: "Mar 15, 2026",
    readingTime: "5 min",
  },
] as const;

/**
 * Post cards lost their 160px gradient cover blocks.
 *
 * Those covers carried no information — the gradient was picked per post at
 * random and the icon inside it repeated the category badge printed directly
 * underneath. Removing them lets the headline lead, which is the only part a
 * reader actually chooses on, and takes a third off the card height.
 */
export function BlogPreviewSection() {
  return (
    <Section surface="base" labelledBy="blog-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading
          id="blog-heading"
          label="Writing"
          title="From the blog"
          lede="Tips and guides for running a service business."
          className="flex-1"
        />
        <Reveal delay={60}>
          <Button asChild variant="outline" className="h-10">
            <Link href="/blog">
              All posts
              <IconArrowRight className="!size-4" />
            </Link>
          </Button>
        </Reveal>
      </div>

      <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-3">
        {PREVIEW_POSTS.map((post, i) => (
          <Reveal key={post.slug} delay={i * 90}>
            <Card className="group relative h-full transition-colors duration-200 hover:border-brand/40">
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-[11px]">
                    {post.category}
                  </Badge>
                  <span className="tnum font-mono text-[11px] text-muted-foreground">
                    {post.readingTime}
                  </span>
                </div>

                <h3 className="mt-4 font-heading text-lg font-semibold leading-snug text-ink text-pretty">
                  {/* Stretched link — the whole card is the hit area, but only
                      the title is announced as the link. */}
                  <Link
                    href={`/blog/${post.slug}`}
                    className="after:absolute after:inset-0 group-hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {post.title}
                  </Link>
                </h3>

                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted-foreground text-pretty">
                  {post.excerpt}
                </p>

                <p className="tnum mt-5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {post.date}
                </p>
              </CardContent>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
