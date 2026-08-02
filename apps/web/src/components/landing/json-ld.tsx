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
    /*
     * No `aggregateRating`. It claimed 4.9 from 500 ratings, and no such
     * ratings exist. The earlier concern here was that the number disagreed
     * with the hero, which was the smaller of the two problems: asserting a
     * review count you do not have is a structured-data violation whether or
     * not the visible page repeats it. Reinstate this block only when there is
     * a real review source to derive it from, and derive it rather than typing
     * a figure in.
     */
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
