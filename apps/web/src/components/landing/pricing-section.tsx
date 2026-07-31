import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableRow,
} from "@/components/ui/table";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

const INCLUDED = [
  "Unlimited jobs and customers",
  "Customer self-booking portal",
  "Invoicing and online payments",
  "Quote builder with PDF export",
  "Job board with custom stages",
  "Revenue and job analytics",
  "Equipment and asset tracking",
  "Maintenance contracts",
  "Checklist templates",
  "Email notifications",
  "Works on any phone",
  "Support from a person",
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
  { what: "Paper diary and clipboard", cost: "—", note: "Slow, and it gets lost" },
  { what: "Phone-tag scheduling", cost: "—", note: "Missed calls are missed jobs" },
  { what: "Spreadsheets", cost: "$10", note: "Per month" },
  { what: "Three separate apps", cost: "$150", note: "Per month, typical" },
] as const;

export function PricingSection() {
  return (
    <Section id="pricing" surface="alt" labelledBy="pricing-heading">
      <SectionHeading
        id="pricing-heading"
        label="Pricing"
        title="One plan. One price. Everything in it."
        lede="Priced per business, not per user — bring your helper and your office manager at no extra cost."
      />

      {/*
        `lg:items-start` — the two cards carry genuinely different amounts of
        content, so stretching them to a shared height left ~300px of dead space
        under whichever finished first. The price rail now sizes to itself and
        sticks while the longer column scrolls past, which turns the difference
        into a deliberate rail instead of a hole.
      */}
      <div className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-5 lg:items-start">
        {/* Price + CTA */}
        <Reveal className="lg:sticky lg:top-24 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col p-6 sm:p-8">
              <Badge variant="brand" className="w-fit font-mono text-[11px]">
                Everything plan
              </Badge>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="tnum font-heading text-5xl font-bold tracking-tight text-ink sm:text-6xl">
                  $49
                </span>
                <span className="text-lg text-muted-foreground">/mo</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Per business, billed monthly. Cancel whenever you like.
              </p>

              <Separator className="my-6" />

              <Button
                asChild
                size="lg"
                className="h-12 w-full text-base font-semibold"
              >
                <Link href="/signup">Start free trial</Link>
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                No card required to start
              </p>

              <Separator className="my-6" />

              <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
                {[
                  { term: "Setup fee", detail: "None" },
                  { term: "Contract", detail: "None — monthly" },
                  { term: "Extra users", detail: "Included" },
                  { term: "Your data", detail: "Export any time" },
                ].map((row) => (
                  <div key={row.term}>
                    <dt className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {row.term}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-ink">
                      {row.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </Reveal>

        {/* What's included */}
        <Reveal delay={100} className="lg:col-span-3">
          <Card className="h-full">
            <CardContent className="p-6 sm:p-8">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Included
              </h3>
              <ul
                role="list"
                className="mt-5 grid gap-x-6 gap-y-3.5 sm:grid-cols-2"
              >
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <IconCheck
                      size={16}
                      stroke={2.5}
                      className="mt-0.5 shrink-0 text-brand"
                      aria-hidden="true"
                    />
                    <span className="text-sm text-ink/80">{item}</span>
                  </li>
                ))}
              </ul>

              <Separator className="my-7" />

              <Table>
                <TableCaption className="caption-top mt-0 pb-3 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  What it replaces
                </TableCaption>
                <TableBody>
                  {REPLACES.map((row) => (
                    <TableRow key={row.what} className="border-border">
                      <TableCell className="px-0 py-3 align-top">
                        <span className="block text-[13px] font-medium text-ink">
                          {row.what}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {row.note}
                        </span>
                      </TableCell>
                      <TableCell className="tnum px-0 py-3 text-right align-top font-mono text-[13px] text-muted-foreground">
                        {row.cost}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter className="border-t-0 bg-transparent">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableCell className="px-0 py-3 text-[13px] font-semibold text-ink">
                      Zaxvio, all of it
                    </TableCell>
                    <TableCell className="tnum px-0 py-3 text-right font-mono text-[13px] font-semibold text-brand">
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
