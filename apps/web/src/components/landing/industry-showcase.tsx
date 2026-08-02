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
      "Book inspections, track panel upgrades, and run a safety checklist on every job so nothing ships out of code. Invoice from the site.",
    bullets: [
      "Inspection scheduling",
      "Panel and circuit records",
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
      "Recurring bookings repeat themselves, your crew sees their own day, and every property keeps its own list of what needs doing.",
    bullets: [
      "Recurring booking automation",
      "Per-property checklists",
      "Team schedule management",
      "Customer property profiles",
    ],
  },
  {
    id: "landscaping",
    label: "Landscaping",
    icon: IconPlant2,
    headline: "Built for landscapers",
    description:
      "Plan the season, keep maintenance contracts on schedule, and document each property with photos. Quote and invoice from the field.",
    bullets: [
      "Seasonal job planning",
      "Maintenance contract tracking",
      "Property photo documentation",
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
 */
export function IndustryShowcase() {
  return (
    <Section id="industries" surface="alt" labelledBy="industries-heading">
      <SectionHeading
        id="industries-heading"
        title="One platform. Every service trade."
        lede="The same board, quotes and invoices, set up for how your trade actually works."
      />

      <Tabs defaultValue="hvac" className="mt-10 gap-0 sm:mt-12">
        <div className="strip-scroll -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <TabsList className="w-max min-w-full gap-1">
            {INDUSTRIES.map((industry) => (
              <TabsTrigger
                key={industry.id}
                value={industry.id}
                className="gap-2 px-3 py-2.5 text-sm sm:px-4"
              >
                <industry.icon size={16} stroke={1.6} aria-hidden="true" />
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
        <div className="mt-6">
          <TabsContents>
            {INDUSTRIES.map((industry) => (
              <TabsContent key={industry.id} value={industry.id} className="mt-0">
                <Card>
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-start gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <industry.icon
                          size={22}
                          stroke={1.6}
                          aria-hidden="true"
                        />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-heading text-xl font-bold tracking-tight text-ink sm:text-2xl">
                          {industry.headline}
                        </h3>
                        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground text-pretty">
                          {industry.description}
                        </p>
                      </div>
                    </div>

                    <ul
                      role="list"
                      className="mt-7 grid gap-x-6 gap-y-3 sm:grid-cols-2"
                    >
                      {industry.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5">
                          <IconCheck
                            size={16}
                            stroke={2.5}
                            className="mt-0.5 shrink-0 text-brand"
                            aria-hidden="true"
                          />
                          <span className="text-sm text-ink/80">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </TabsContents>
        </div>
      </Tabs>
    </Section>
  );
}
