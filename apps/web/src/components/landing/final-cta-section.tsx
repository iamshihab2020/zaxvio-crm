import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

/**
 * Closing band.
 *
 * Sits on the always-dark `midnight` slab and runs straight into the footer
 * with no seam, so the page ends on one dark foot in both themes. The ruled
 * wash is the same motif the hero opens with — the page closes the way it
 * started.
 */
export function FinalCtaSection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden bg-midnight text-midnight-foreground"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, hsl(var(--midnight-foreground)) 1px, transparent 1px)",
          backgroundSize: "100% 3rem",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal className="max-w-2xl">
          {/* The "Start today" eyebrow that sat here is gone. It was one of ten
              mono-caps labels on the page, and it told the reader nothing the
              headline and the button underneath it do not. */}
          <h2
            id="final-cta-heading"
            className="font-heading text-[1.75rem] font-bold leading-[1.15] tracking-tight text-balance sm:text-4xl lg:text-5xl"
          >
            Your next job could already be on the board.
          </h2>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-midnight-foreground/60 sm:text-lg">
            Set it up in ten minutes, then run your business on it for two weeks
            before you decide.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              asChild
              size="lg"
              className="h-12 w-full px-7 text-base font-semibold sm:w-auto"
            >
              <Link href="/signup">
                Start free trial
                <IconArrowRight className="!size-[18px]" />
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 w-full px-7 text-base text-midnight-foreground/70 hover:bg-midnight-light hover:text-midnight-foreground sm:w-auto"
            >
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>

          {/* Was a mono-caps strip reading
              "No card required · Cancel any time · Export your data": two
              separators on one line, in the treatment this page had already
              used nine times. Same three facts, read as a sentence. */}
          {/* "…and export your data whenever you want it" was cut here
              (LAND-02): there is no export. */}
          <p className="mt-6 text-sm text-midnight-foreground/60">
            14 days free, no card required. Cancel any time.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
