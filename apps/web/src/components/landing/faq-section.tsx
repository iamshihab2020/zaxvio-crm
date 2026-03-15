"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionReveal } from "./section-reveal";

const FAQ_ITEMS = [
  {
    question: "Do I need to be tech-savvy to use Zaxvio?",
    answer:
      "Not at all. If you can text and browse the web on your phone, you can use Zaxvio. Most contractors are fully set up within 10 minutes.",
  },
  {
    question: "Can my customers book appointments online?",
    answer:
      "Yes. You get a public booking page where customers can see your real-time availability and book a time slot. No more phone tag.",
  },
  {
    question: "What happens after my free trial ends?",
    answer:
      "Your account stays active at $49/month. No annual contracts — cancel anytime with one click. Your data is always exportable.",
  },
  {
    question: "Can I send invoices from the field?",
    answer:
      "Absolutely. Create and send professional invoices right from your phone as soon as a job is done. Customers can pay online instantly.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Your data is stored in SOC 2-compliant cloud infrastructure with encryption at rest and in transit. We never share your customer data.",
  },
  {
    question: "Does it work for teams of 2–3 people?",
    answer:
      "Yes. You can invite a helper or office manager to your account. Everyone sees the same schedule and job statuses in real time.",
  },
  {
    question: "Can I import my existing customer list?",
    answer:
      "Yes. During setup you can import customers from a spreadsheet (CSV/Excel). We also offer free migration help if you need it.",
  },
  {
    question: "What states do you support?",
    answer:
      "We're currently focused on Texas and Florida, including compliance with state-specific HVAC licensing and refrigerant logging requirements.",
  },
] as const;

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="bg-surface py-24"
    >
      <div className="mx-auto max-w-3xl px-6">
        <SectionReveal className="text-center">
          <h2
            id="faq-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-ink/60">
            Got questions? We&apos;ve got answers.
          </p>
        </SectionReveal>

        <SectionReveal delay={150}>
          <Accordion type="single" collapsible className="mt-12">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-ink">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-ink/70">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionReveal>
      </div>
    </section>
  );
}
