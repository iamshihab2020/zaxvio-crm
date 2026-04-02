import type { Metadata } from "next";
import { BlogListingClient } from "./blog-listing-client";

export const metadata: Metadata = {
  title: "Blog — Tips & Guides for Service Businesses",
  description:
    "Practical tips, guides, and industry insights to help you run a more efficient service business. From scheduling to invoicing.",
  openGraph: {
    title: "Zaxvio Blog — Service Business Tips & Guides",
    description:
      "Practical tips, guides, and industry insights for field service businesses.",
    type: "website",
  },
};

export default function BlogPage() {
  return <BlogListingClient />;
}
