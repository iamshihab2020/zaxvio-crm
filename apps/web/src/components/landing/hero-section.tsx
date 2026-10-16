import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { DaySheet } from "./day-sheet";

/**
 * Hero.
 *
 * Paints with the HTML. Nothing up here is wrapped in `<Reveal>`, and that is
 * the point (LAND-04): `.js .reveal` is `opacity: 0` from first paint until
 * React hydrates and an IntersectionObserver fires, so the headline (the
 * page's LCP element) used to wait on the whole client bundle, and an
 * `opacity: 0` element is not even an LCP candidate until it shows. Below the
 * fold that cost is invisible; on the first screen it is the load time. Do not
 * re-wrap anything in this component.
 *
 * The headline no longer carries a rotating industry word. That trick reflowed
 * the <h1> every 2.5 seconds, a measurable layout shift on the page's largest
 * text, and left the heading's text content unstable for screen readers and
 * crawlers.
 *
 * There is no eyebrow. It read "Field service software" in mono caps above the
 * headline, which said what the headline and the product already say, and an
 * eyebrow above a heading is a pattern this page has retired everywhere else.
 *
 * The rating row that sat under the CTAs is gone. It made the hero five text
 * elements deep, and the figure itself ("4.9 from 500+ service businesses") was
 * invented: there are no such reviews. It was also mirrored into JSON-LD as an
 * aggregateRating, which is a rich-results violation rather than a design
 * choice. The trial terms it shared a line with are stated in Pricing and again
 * in the closing band, so nothing true was lost.
 */
export function HeroSection() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-surface pb-14 pt-24 sm:pb-16 sm:pt-28 lg:pb-20 lg:pt-32"
    >
      {/* Ruled texture + a single warm wash behind the headline. Replaces the
          animated aurora gradient: a nebula says "AI startup", ruled paper says
          "work order".

          The wash is a radial gradient that already fades to transparent, so it
          carries no `blur-3xl`. The filter added nothing visible and cost a GPU
          raster of a 1088×576px layer, which the fixed navbar's backdrop blur
          then recomposited over on every scroll frame (LAND-11). */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="sheet-wash absolute inset-0 opacity-60" />
        <div
          className="absolute -top-40 left-1/2 h-[36rem] w-[68rem] -translate-x-1/2 rounded-full opacity-70"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(var(--brand) / 0.14) 0%, transparent 65%)",
          }}
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-8">
        {/* Copy */}
        <div className="lg:col-span-6">
          <h1
            id="hero-heading"
            className="font-heading text-[2.5rem] font-bold leading-[1.05] tracking-tight text-ink text-balance sm:text-5xl lg:text-6xl"
          >
            Run the whole day from one screen.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            Your schedule, quotes, invoices and customer history in one place.
            Book a job, finish it, get paid.
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
              variant="outline"
              size="lg"
              className="h-12 w-full px-7 text-base sm:w-auto"
            >
              <a href="#features">See what&rsquo;s included</a>
            </Button>
          </div>
        </div>

        {/* Signature */}
        <div className="lg:col-span-6">
          <DaySheet />
        </div>
      </div>
    </section>
  );
}
