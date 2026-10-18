import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/*
 * Every line is something the product does today (PRODUCT.md → Capabilities).
 * "Invoicing and online payments" and "Support from a person" were here until
 * LAND-02/10: there is no payment processor, and no support contact anywhere.
 * Automations replace the support line because they are one of the four edges
 * PRODUCT.md confirms, and the page did not mention them at all.
 */
const INCLUDED = [
  "Unlimited jobs and customers",
  "Customer self-booking portal",
  "Invoicing and payment tracking",
  "Quotes customers accept online",
  "Job board with custom stages",
  "Reports, job costing and margins",
  "Equipment and asset tracking",
  "Service agreements",
  "Checklist templates",
  "Email notifications",
  "Automations with ready-made templates",
  "Works on any phone",
] as const;

const TERMS = [
  { term: "Setup fee", detail: "None" },
  { term: "Contract", detail: "None, monthly" },
  { term: "Extra users", detail: "Included" },
  { term: "Free trial", detail: "14 days, no card" },
] as const;

/**
 * The replacement ledger.
 *
 * This was a footnote under the pricing card — four decorative tiles with
 * struck-through costs that never added up to anything. It is the most
 * persuasive content on the page, so it is now a real table whose column
 * totals: $160+ a month of tools and lost calls against $49. Tabular figures
 * mean the numbers line up and can actually be read down the column.
 */
const REPLACES = [
  { what: "Paper diary and clipboard", cost: "No cost", note: "Slow, and it gets lost" },
  { what: "Phone-tag scheduling", cost: "No cost", note: "Missed calls are missed jobs" },
  // Estimates, and labelled as estimates: nothing on this page has a source
  // for what a contractor's current tools cost them.
  { what: "Spreadsheets", cost: "$10", note: "Per month, estimated" },
  { what: "Three separate apps", cost: "$150", note: "Per month, estimated" },
] as const;

/**
 * Pricing.
 *
 * Three cards on a 12-column grid: the price on a full-width band, then what is
 * included beside what it replaces. The price used to be a narrow sticky rail
 * beside a taller list, which left a hole under whichever column finished
 * first; as a band the price gets the width its figure deserves, and the two
 * cards below it are close enough in height to share a row without a rail.
 *
 * There are no struck-through "was" prices anywhere here. The only comparison
 * is the ledger, and its two figures are labelled as estimates.
 */
export function PricingSection() {
  return (
    <Section id="pricing" surface="base" labelledBy="pricing-heading">
      <SectionHeading
        id="pricing-heading"
        title="One plan. One price. Everything in it."
        lede="Priced per business, not per user. Bring your helper and your office manager at no extra cost."
      />

      <div className="mt-14 grid gap-5 lg:mt-16 lg:grid-cols-12 lg:gap-6">
        {/* Price + CTA */}
        <Reveal className="lg:col-span-12">
          <Card>
            <CardContent className="grid gap-10 p-6 sm:p-8 lg:grid-cols-12 lg:items-center lg:gap-x-12 lg:p-10">
              <div className="lg:col-span-6">
                <Badge variant="brand" className="w-fit text-xs">
                  Everything plan
                </Badge>

                <div className="mt-5 flex items-baseline gap-2">
                  <span className="tnum font-heading text-7xl font-bold leading-none tracking-tight text-ink sm:text-8xl">
                    $49
                  </span>
                  <span className="text-xl text-muted-foreground">/ month</span>
                </div>
                <p className="mt-4 text-lg text-muted-foreground">
                  Per business, billed monthly. Cancel whenever you like.
                </p>
              </div>

              <div className="lg:col-span-6 lg:border-l lg:border-border lg:pl-12">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
                  {TERMS.map((row) => (
                    <div key={row.term}>
                      <dt className="text-sm text-muted-foreground">
                        {row.term}
                      </dt>
                      <dd className="mt-1 text-base font-semibold text-ink">
                        {row.detail}
                      </dd>
                    </div>
                  ))}
                </dl>

                <Button
                  asChild
                  size="lg"
                  className="mt-8 h-12 w-full text-base font-semibold"
                >
                  <Link href="/signup">Start free trial</Link>
                </Button>
                <p className="mt-3 text-center text-sm text-muted-foreground">
                  No card required to start
                </p>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        {/* What's included */}
        <Reveal delay={80} className="lg:col-span-7">
          <Card className="h-full">
            <CardContent className="p-6 sm:p-8">
              <h3 className="font-heading text-lg font-semibold text-ink">
                Included
              </h3>
              <ul
                role="list"
                className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2"
              >
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <IconCheck
                      size={20}
                      stroke={2.5}
                      className="mt-0.5 shrink-0 text-brand-ink"
                      aria-hidden="true"
                    />
                    <span className="text-base text-ink">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        {/* What it replaces */}
        <Reveal delay={160} className="lg:col-span-5">
          <Card className="h-full">
            <CardContent className="p-6 sm:p-8">
              <Table>
                <TableCaption className="caption-top mt-0 pb-3 text-left font-heading text-lg font-semibold text-ink">
                  What it replaces
                </TableCaption>
                {/* Each row is headed by what it replaces (`<th scope="row">`),
                    so a screen reader announces "Spreadsheets, $10" rather than
                    two bare cells (LAND-14). */}
                <TableBody>
                  {REPLACES.map((row) => (
                    <TableRow key={row.what} className="border-border">
                      <TableHead
                        scope="row"
                        className="h-auto px-0 py-3.5 align-top font-normal"
                      >
                        <span className="block text-base font-medium text-ink">
                          {row.what}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {row.note}
                        </span>
                      </TableHead>
                      <TableCell className="tnum px-0 py-3.5 text-right align-top text-base text-muted-foreground">
                        {row.cost}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="border-t-0 bg-transparent">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead
                      scope="row"
                      className="h-auto px-0 py-3.5 text-base font-semibold text-ink"
                    >
                      Zaxvio, all of it
                    </TableHead>
                    <TableCell className="tnum px-0 py-3.5 text-right text-base font-bold text-brand-ink">
                      $49
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </Section>
  );
}
