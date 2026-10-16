/**
 * The landing FAQ, and the `FAQPage` structured data built from it in
 * `components/landing/json-ld.tsx`, so every answer here is also handed to
 * search engines as a statement of fact.
 *
 * Answer only with what the product does today. PRODUCT.md keeps the list of
 * things that are NOT built (online payments, spreadsheet import, data export,
 * recurring bookings, billing). Four answers claimed some of them until LAND-02.
 */
export const FAQ_ITEMS = [
  {
    question: "Do I need to be tech-savvy to use Zaxvio?",
    answer:
      "Not at all. If you can text and browse the web on your phone, you can use Zaxvio. Setting up takes about ten minutes.",
  },
  {
    question: "What industries does Zaxvio support?",
    answer:
      "Zaxvio works for any field service business: HVAC, plumbing, electrical, cleaning, landscaping, and more. If you schedule jobs and invoice customers, Zaxvio fits your workflow.",
  },
  {
    question: "Can my customers book appointments online?",
    answer:
      "Yes. You get a public booking page where customers can see your real-time availability and book a time slot. No more phone tag.",
  },
  {
    question: "What happens after my free trial ends?",
    answer:
      "The trial runs for 14 days and needs no card. After that, Zaxvio is $49 a month for the whole business, with no annual contract, and you can cancel at any time.",
  },
  {
    question: "Can I send invoices from the field?",
    answer:
      "Yes. Create the invoice on your phone as soon as the job is done and it goes to the customer by email as a PDF. When they pay, you record it against the invoice, including part payments.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Your data is stored with SOC 2 audited providers and encrypted in transit and at rest. We don't sell it, and it only goes to the services the app needs in order to run, which the privacy policy lists by name.",
  },
  {
    question: "Does it work for teams of 2–3 people?",
    answer:
      "Yes. Invite a helper or an office manager at no extra cost, and everyone works from the same schedule and job board.",
  },
  {
    question: "Can I customize job types for my industry?",
    answer:
      "Yes. You define your own service categories, checklist templates, pipeline stages, and pricing. Zaxvio adapts to how you work.",
  },
  {
    question: "Can I import my existing customer list?",
    answer:
      "Not from a file yet. You add customers as you go, and anyone who books through your booking page is added as a customer automatically.",
  },
] as const;
