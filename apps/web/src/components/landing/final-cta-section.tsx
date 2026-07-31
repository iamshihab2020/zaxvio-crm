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
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
            Start today
          </span>

          <h2
            id="final-cta-heading"
            className="mt-5 font-heading text-[2rem] font-bold leading-[1.1] tracking-tight text-balance sm:text-4xl lg:text-5xl"
          >
            Your next job could already be on the board.
          </h2>

          <p className="mt-5 max-w-lg text-base leading-relaxed text-midnight-foreground/60 sm:text-lg">
            Set it up in ten minutes. Keep the free trial running until you know
            it works for you.
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

          <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-midnight-foreground/40">
            No card required &middot; Cancel any time &middot; Export your data
          </p>
        </Reveal>
      </div>
    </section>
  );
}
