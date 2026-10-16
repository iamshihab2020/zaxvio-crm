import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { FAQ_ITEMS } from "@/lib/landing/faq-data";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

export function FaqSection() {
  return (
    <Section id="faq" surface="base" labelledBy="faq-heading">
      <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
        {/* The lede promised "support from a person" with no contact route
            anywhere on the site (LAND-10). Restore it alongside a real one. */}
        <SectionHeading
          id="faq-heading"
          title="Answers, before you ask."
          className="lg:sticky lg:top-28 lg:self-start"
        />

        <Reveal delay={80} className="lg:col-span-2">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={item.question} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium text-ink hover:text-brand-ink">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-[68ch] text-base leading-relaxed text-muted-foreground text-pretty">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </Section>
  );
}
