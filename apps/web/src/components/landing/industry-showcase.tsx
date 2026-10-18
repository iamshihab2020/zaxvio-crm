"use client";

import {
  IconAirConditioning,
  IconBolt,
  IconCheck,
  IconDroplet,
  IconPlant2,
  IconSpray,
  IconTool,
} from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { IconDisc } from "./example-ui";
import { Section, SectionHeading } from "./section";

const INDUSTRIES = [
  {
    id: "hvac",
    label: "HVAC",
    icon: IconAirConditioning,
    headline: "Built for HVAC",
    description:
      "Emergency AC calls and routine maintenance run through the same board. Track the equipment you installed, log refrigerant for compliance, and invoice before you leave the driveway.",
    bullets: [
      "Equipment and maintenance history per address",
      "Refrigerant logging for compliance",
      "Emergency dispatch and scheduling",
      "On-site invoice generation",
    ],
  },
  {
    id: "plumbing",
    label: "Plumbing",
    icon: IconDroplet,
    headline: "Built for plumbing",
    description:
      "Take the callout, document what you found, and turn the quote into a job with one tap. Every customer's pipe history is on their record when the next call comes in.",
    bullets: [
      "Emergency callout management",
      "Photo documentation per job",
      "Quote-to-job conversion",
      "Full customer service history",
    ],
  },
  {
    id: "electrical",
    label: "Electrical",
    icon: IconBolt,
    headline: "Built for electricians",
    description:
      "Book inspections, track panel upgrades, and make the safety checklist something a job can't be marked complete without. Invoice from the site.",
    bullets: [
      "Inspection scheduling",
      // Was "Panel and circuit records" (LAND-20). There is no circuit model;
      // what exists is equipment records on the customer, for any trade.
      "Equipment records for every customer",
      "Safety checklist templates",
      "Field invoicing",
    ],
  },
  {
    id: "cleaning",
    label: "Cleaning",
    icon: IconSpray,
    headline: "Built for cleaning services",
    description:
      "Regular clients run on a service agreement, your crew sees the jobs assigned to them, and a checklist makes every visit cover the same ground.",
    bullets: [
      "Service agreements for regular visits",
      "A checklist on every job",
      "Team schedule management",
      "Notes and history on every customer",
    ],
  },
  {
    id: "landscaping",
    label: "Landscaping",
    icon: IconPlant2,
    headline: "Built for landscapers",
    description:
      "Lay out the season on the calendar, keep service agreements on schedule, and photograph the work on every job. Quote and invoice from the field.",
    bullets: [
      // Was "Seasonal job planning" (LAND-20): there is no seasonal planner.
      // The calendar with drag-to-reschedule is what a season is planned on.
      "Drag-and-drop calendar for the season",
      "Service agreement tracking",
      "Before-and-after photos on every job",
      "Quote builder",
    ],
  },
  {
    id: "general",
    label: "Any trade",
    icon: IconTool,
    headline: "Built for any service business",
    description:
      "Zaxvio isn't locked to one trade. If you book jobs, serve customers and send invoices, it fits. You define the service types, the stages and the checklists.",
    bullets: [
      "Custom service categories",
      "Flexible checklist builder",
      "Job stages you define",
      "Works for any field service",
    ],
  },
] as const;

/**
 * Industries.
 *
 * Rebuilt on shadcn `Tabs`. The previous version was a hand-rolled list of
 * `<button>`s in a grid column, which cost roving-focus keyboard support and
 * caused the page's worst layout bug: the column was a grid item, grid items
 * default to `min-width: auto`, and so the `overflow-x-auto` strip inside it
 * never clipped. Measured on a 390px viewport, that pushed the document to
 * 976px wide — every section on the page scrolled sideways because of this one
 * element. A full-width strip above the panel cannot reproduce it.
 *
 * The panel is two columns from `lg`: the description, set large, on the left
 * and the checklist in a card on the right. One card of mixed content left the
 * right half of a wide screen empty and made the bullets read as an
 * afterthought; here they are the thing you scan.
 */
export function IndustryShowcase() {
  return (
    <Section id="industries" surface="base" labelledBy="industries-heading">
      <SectionHeading
        id="industries-heading"
        title="One platform. Every service trade."
        lede="The same board, quotes and invoices, set up for how your trade actually works."
      />

      <Tabs defaultValue="hvac" className="mt-12 gap-0 lg:mt-14">
        <div className="strip-scroll -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full gap-1">
            {INDUSTRIES.map((industry) => (
              <TabsTrigger
                key={industry.id}
                value={industry.id}
                className="gap-2 px-3 py-2.5 text-base sm:px-5"
              >
                <industry.icon size={18} stroke={1.6} aria-hidden="true" />
                {industry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/*
          The gap between the strip and the panel lives OUT here, not on
          TabsContent. TabsContents wraps its child in an AutoHeight measurer
          with `overflow: hidden`; a top margin on the measured child collapses
          out of the measured box, so the panel rendered exactly one margin
          short and clipped its own last row of bullets.
        */}
        <div className="mt-8 lg:mt-10">
          <TabsContents>
            {INDUSTRIES.map((industry) => (
              <TabsContent key={industry.id} value={industry.id} className="mt-0">
                <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-x-12">
                  <div className="lg:col-span-6">
                    <IconDisc icon={industry.icon} size="lg" />
                    <h3 className="mt-5 font-heading text-2xl font-bold leading-tight tracking-tight text-ink text-balance sm:text-3xl">
                      {industry.headline}
                    </h3>
                    <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
                      {industry.description}
                    </p>
                  </div>

                  <Card className="lg:col-span-6">
                    <CardContent className="p-2 sm:p-3">
                      <ul role="list" className="divide-y divide-border">
                        {industry.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="flex items-start gap-3 px-3 py-3.5 sm:px-4"
                          >
                            <IconCheck
                              size={20}
                              stroke={2.5}
                              className="mt-0.5 shrink-0 text-brand-ink"
                              aria-hidden="true"
                            />
                            <span className="text-base text-ink">{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </TabsContents>
        </div>
      </Tabs>
    </Section>
  );
}
