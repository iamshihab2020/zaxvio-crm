import { FAQ_ITEMS } from "@/lib/landing/faq-data";

function SoftwareApplicationSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Zaxvio",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "All-in-one service management software for field service businesses. Scheduling, invoicing, and customer management.",
    offers: {
      "@type": "Offer",
      price: "49",
      priceCurrency: "USD",
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
    },
    // Must match the rating rendered in the hero. Structured data that
    // contradicts the visible page is a rich-results violation, and this said
    // 4.8 from 127 while the page said 4.9 from 500+.
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "500",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function FAQSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function JsonLd() {
  return (
    <>
      <SoftwareApplicationSchema />
      <FAQSchema />
    </>
  );
}
