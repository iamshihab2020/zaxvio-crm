"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BLOG_POSTS, type BlogPost } from "@/lib/blog/posts";
import { useStagger } from "@/hooks/use-stagger";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "business-tips", label: "Business Tips" },
  { id: "guides", label: "Guides" },
  { id: "industry-insights", label: "Industry Insights" },
] as const;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block h-full">
      <Card className="h-full overflow-hidden transition-colors duration-200 group-hover:border-brand/40">
        <div
          className={`h-48 bg-gradient-to-br ${post.coverGradient}`}
          aria-hidden="true"
        />
        <CardContent className="p-6">
          <Badge variant="secondary" className="mb-3 text-xs">
            {post.categoryLabel}
          </Badge>
          <h3 className="font-heading text-lg font-semibold text-ink line-clamp-2 group-hover:text-brand-ink transition-colors">
            {post.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink/60 line-clamp-2">
            {post.excerpt}
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-ink/40">
            <span>{formatDate(post.date)}</span>
            <span>&middot;</span>
            <span>{post.readTime}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function BlogListingClient() {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredPosts =
    activeCategory === "all"
      ? BLOG_POSTS
      : BLOG_POSTS.filter((p) => p.category === activeCategory);

  // The posts are server-rendered at rest (the cards used to start at opacity 0
  // behind a scroll-reveal, which hid the whole list without JavaScript). Only
  // a category change lays the new set out in turn; the key is the category,
  // not the array, so nothing replays on its own.
  const gridRef = useRef<HTMLDivElement>(null);
  useStagger(gridRef, activeCategory);

  return (
    <div className="bg-surface py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Blog
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink/60">
            Tips, guides, and insights for service businesses.
          </p>
        </div>

        {/* Category filter */}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
              className={
                activeCategory === cat.id
                  ? "bg-brand text-brand-foreground hover:bg-brand/90"
                  : ""
              }
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Post grid */}
        <div
          ref={gridRef}
          className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredPosts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>

        {filteredPosts.length === 0 && (
          <p className="motion-appear mt-16 text-center text-ink/50">
            No posts in this category yet.
          </p>
        )}
      </div>
    </div>
  );
}
