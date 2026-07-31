import {
  IconAirConditioning,
  IconBolt,
  IconDroplet,
  IconPlant2,
  IconSpray,
  IconTool,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "./reveal";

const INDUSTRIES = [
  { icon: IconAirConditioning, label: "HVAC" },
  { icon: IconDroplet, label: "Plumbing" },
  { icon: IconBolt, label: "Electrical" },
  { icon: IconSpray, label: "Cleaning" },
  { icon: IconPlant2, label: "Landscaping" },
  { icon: IconTool, label: "Handyman" },
] as const;

/**
 * Trust strip.
 *
 * Was a 342px band of four animated counter cards — "500+ businesses",
 * "4.9★", "6+ industries", "99% uptime" — two of which repeated numbers the
 * hero had already stated a screen earlier, and one of which ("6+ industries")
 * simply counted the row of icons printed underneath it. Repeating a claim
 * three times weakens it. The count now lives in the hero; this strip carries
 * the one thing the hero cannot, which is the breadth itself.
 */
export function TrustBar() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-border bg-surface-alt py-7"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <h2
            id="trust-heading"
            className="shrink-0 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            Built for
          </h2>

          {/* Wraps on desktop, scrolls on mobile — never forces the page wide. */}
          <ul
            role="list"
            className="strip-scroll -mx-5 flex min-w-0 gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
          >
            {INDUSTRIES.map((industry) => (
              <li key={industry.label}>
                <Badge
                  variant="secondary"
                  className="gap-1.5 whitespace-nowrap px-3 py-1.5 text-[13px] font-medium text-muted-foreground"
                >
                  <industry.icon size={15} stroke={1.6} aria-hidden="true" />
                  {industry.label}
                </Badge>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
