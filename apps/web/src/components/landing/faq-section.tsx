import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/animate-ui/components/radix/accordion";
import { FAQ_ITEMS } from "@/lib/landing/faq-data";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/**
 * FAQ.
 *
 * The heading takes the narrow left rail (`layout="stacked"`) and sticks while
 * the questions scroll past, because a nine-item accordion is the one section
 * tall enough to need an anchor on the page. Everywhere else the heading spans
 * the top, and here it would have left the accordion alone in a 68ch column
 * with nothing beside it.
 */
export function FaqSection() {
  return (
    <Section id="faq" surface="alt" labelledBy="faq-heading">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-x-12">
        {/* The lede promised "support from a person" with no contact route
            anywhere on the site (LAND-10). The new one says only what the
            answers below do: they cover the trial, the price and what the
            product does today. */}
        <SectionHeading
          id="faq-heading"
          title="Answers, before you ask."
          lede="Plain answers about the trial, the price and what Zaxvio does today."
          layout="stacked"
          className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start"
        />

        <Reveal delay={80} className="lg:col-span-7">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={item.question} value={`faq-${i}`}>
                <AccordionTrigger className="py-5 text-left text-lg font-medium text-ink hover:text-brand-ink">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-[68ch] pb-5 text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
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
