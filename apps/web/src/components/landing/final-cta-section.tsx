import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "./reveal";
import { Section } from "./section";

/**
 * Closing call to action.
 *
 * One large bordered card on the alt surface, headline at the page's biggest
 * size on the left and the action on the right. It was a full-bleed navy slab
 * with a ruled wash; the user rejected the saturated band (2026-10-18), so the
 * page now closes on the same neutral surfaces it opened on and the footer's
 * navy is the only dark foot. What makes this the closing call to action is
 * scale and the one blue button, not a coloured band behind it.
 *
 * The section is `alt`, so it alternates against the Blog section above it and
 * stays distinct from the footer below, which is navy in both themes and opens
 * with its own hairline.
 */
export function FinalCtaSection() {
  return (
    <Section surface="alt" labelledBy="final-cta-heading">
      <Reveal>
        <Card className="p-8 sm:p-12 lg:p-16">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-x-12">
            <div className="lg:col-span-7">
              {/* The "Start today" eyebrow that sat here is gone. It was one of
                  ten mono-caps labels on the page, and it told the reader
                  nothing the headline and the button underneath it do not. */}
              <h2
                id="final-cta-heading"
                className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-ink text-balance sm:text-5xl lg:text-6xl"
              >
                Your next job could already be on the board.
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl">
                Set it up in ten minutes, then run your business on it for two
                weeks before you decide.
              </p>
            </div>

            <div className="lg:col-span-5">
              <Button
                asChild
                size="lg"
                className="h-14 w-full px-8 text-lg font-semibold"
              >
                <Link href="/signup">
                  Start free trial
                  <IconArrowRight className="!size-5" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="mt-2 h-12 w-full px-8 text-base text-muted-foreground hover:text-ink"
              >
                <Link href="/login">I already have an account</Link>
              </Button>

              {/* Was a mono-caps strip reading
                  "No card required · Cancel any time · Export your data": two
                  separators on one line, in the treatment this page had already
                  used nine times. Same three facts, read as a sentence.
                  "…and export your data whenever you want it" was cut here
                  (LAND-02): there is no export. */}
              <p className="mt-5 text-center text-sm text-muted-foreground">
                14 days free, no card required. Cancel any time.
              </p>
            </div>
          </div>
        </Card>
      </Reveal>
    </Section>
  );
}
