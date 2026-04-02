"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";
import { FAQ_ITEMS } from "@/lib/landing/faq-data";

export function FaqSection() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="bg-surface py-16 sm:py-20"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Fade inView inViewOnce className="text-center">
          <h2
            id="faq-heading"
            className="font-heading text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-ink/60">
            Got questions? We&apos;ve got answers.
          </p>
        </Fade>

        <Fade inView inViewOnce delay={150}>
          <Accordion type="single" collapsible className="mt-8">
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
        </Fade>
      </div>
    </section>
  );
}
