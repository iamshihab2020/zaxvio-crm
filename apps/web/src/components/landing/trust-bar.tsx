import {
  IconAirConditioning,
  IconBolt,
  IconDroplet,
  IconPlant2,
  IconSpray,
  IconTool,
} from "@tabler/icons-react";
import { IconDisc } from "./example-ui";
import { Reveal } from "./reveal";

const INDUSTRIES = [
  { icon: IconAirConditioning, label: "HVAC" },
  { icon: IconDroplet, label: "Plumbing" },
  { icon: IconBolt, label: "Electrical" },
  { icon: IconSpray, label: "Cleaning" },
  { icon: IconPlant2, label: "Landscaping" },
  { icon: IconTool, label: "Any trade" },
] as const;

/**
 * Trades strip.
 *
 * Was a 342px band of four animated counter cards — "500+ businesses",
 * "4.9★", "6+ industries", "99% uptime" — none of which had anything behind
 * it. This strip carries the one thing the page can state truthfully, which is
 * the breadth itself.
 *
 * The six labels match the Industries tabs exactly. The last one used to read
 * "Handyman" here and "Any trade" there (LAND-13); the product is trade-neutral
 * by principle, so "Any trade" is the one that is true.
 *
 * The trades are 8px bordered tiles with a round icon disc, not pills: a pill
 * means a state in this system, and a trade is not one. From `sm` they wrap at
 * their natural width (all six fit one row at 1024px, where a fixed six-column
 * grid would clip "Landscaping"); on a phone they stay one row that scrolls
 * sideways, so the strip never forces the page wide.
 */
export function TrustBar() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="border-y border-border bg-surface-alt py-12 lg:py-14"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
        <Reveal>
          <h2
            id="trust-heading"
            className="font-heading text-xl font-semibold tracking-tight text-ink sm:text-2xl"
          >
            Built for every service trade
          </h2>

          <ul
            role="list"
            className="strip-scroll -mx-5 mt-6 flex min-w-0 gap-3 overflow-x-auto px-5 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
          >
            {INDUSTRIES.map((industry) => (
              <li
                key={industry.label}
                className="flex shrink-0 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
              >
                <IconDisc icon={industry.icon} size="sm" />
                <span className="whitespace-nowrap text-base font-medium text-ink">
                  {industry.label}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
