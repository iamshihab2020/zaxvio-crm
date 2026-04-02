"use client";

import Link from "next/link";
import {
  IconArrowRight,
  IconBulb,
  IconBook,
  IconTrendingUp,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

const PREVIEW_POSTS = [
  {
    slug: "streamline-service-business-operations",
    title: "5 Ways to Streamline Your Service Business Operations",
    excerpt:
      "From digital scheduling to automated invoicing, discover how top service businesses eliminate paperwork and win back hours every week.",
    category: "Business Tips",
    date: "Mar 28, 2026",
    gradient: "from-brand via-orange-500 to-amber-400",
    icon: IconBulb,
  },
  {
    slug: "complete-guide-digital-invoicing",
    title: "The Complete Guide to Digital Invoicing for Field Service",
    excerpt:
      "Stop chasing payments. Learn how field service professionals use on-site invoicing to get paid the same day.",
    category: "Guides",
    date: "Mar 22, 2026",
    gradient: "from-blue-600 via-blue-400 to-cyan-400",
    icon: IconBook,
  },
  {
    slug: "paper-to-digital-service-businesses",
    title: "Why Service Businesses Are Switching from Paper to Digital",
    excerpt:
      "The clipboard-and-carbon-copy era is ending. Here's why the smartest service businesses are going digital — and how to make the switch.",
    category: "Industry Insights",
    date: "Mar 15, 2026",
    gradient: "from-emerald-600 via-emerald-400 to-teal-300",
    icon: IconTrendingUp,
  },
] as const;

export function BlogPreviewSection() {
  return (
    <section
      aria-labelledby="blog-preview-heading"
      className="bg-surface py-24"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Fade inView inViewOnce className="text-center">
          <h2
            id="blog-preview-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            From the Blog
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/60">
            Tips, guides, and insights for service businesses.
          </p>
        </Fade>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {PREVIEW_POSTS.map((post, i) => (
            <Fade key={post.slug} inView inViewOnce delay={i * 100}>
              <Link href={`/blog/${post.slug}`} className="group block h-full cursor-pointer">
                <Card className="h-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg">
                  {/* Cover gradient with grid overlay + icon */}
                  <div
                    className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${post.gradient}`}
                    aria-hidden="true"
                  >
                    {/* Dot grid overlay */}
                    <div
                      className="absolute inset-0 opacity-[0.12]"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle, white 1px, transparent 1px)",
                        backgroundSize: "16px 16px",
                      }}
                    />
                    {/* Category icon */}
                    <post.icon size={48} stroke={1} className="relative text-white/25" />
                  </div>
                  <CardContent className="p-6">
                    <Badge variant="secondary" className="mb-3 text-xs">
                      {post.category}
                    </Badge>
                    <h3 className="font-heading text-lg font-semibold text-ink line-clamp-2 group-hover:text-brand transition-colors">
                      {post.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/60 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <p className="mt-4 text-xs text-ink/40">{post.date}</p>
                  </CardContent>
                </Card>
              </Link>
            </Fade>
          ))}
        </div>

        <Fade inView inViewOnce delay={300}>
          <div className="mt-12 text-center">
            <Button asChild variant="outline" className="gap-2">
              <Link href="/blog">
                View All Posts
                <IconArrowRight size={16} stroke={2} />
              </Link>
            </Button>
          </div>
        </Fade>
      </div>
    </section>
  );
}
