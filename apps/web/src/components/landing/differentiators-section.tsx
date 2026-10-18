import {
  IconAlertTriangle,
  IconBolt,
  IconCheck,
  IconFilter,
  IconHourglassHigh,
  IconMail,
} from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { IconDisc, Pill } from "./example-ui";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/* ── Visuals ────────────────────────────────────────────────────────────
   Each row's picture is a piece of the product's own data, drawn from the
   page's tokens at the scale of the row, not a screenshot in a frame. All
   three are `aria-hidden` where they are used; the row's text says the same
   thing in words. The figures are sample data.
   ──────────────────────────────────────────────────────────────────────── */

/* Initials, not people: three generic discs standing for "the owner, a helper
   and an office manager". No names, so nothing here can be mistaken for a
   customer or a testimonial (LAND-01). */
const AVATARS = ["O", "H", "M"] as const;

function PriceVisual() {
  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-6 sm:p-8">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Zaxvio</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="tnum font-heading text-6xl font-bold tracking-tight text-ink">
              $49
            </span>
            <span className="text-lg text-muted-foreground">/ month</span>
          </p>
        </div>
        <Pill tone="brand">Per business</Pill>
      </div>

      <Separator />

      <dl className="divide-y divide-border">
        <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <dt className="text-base text-muted-foreground">Team members</dt>
          <dd className="text-base font-semibold text-ink">Unlimited</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <dt className="flex items-center">
            {AVATARS.map((initial, i) => (
              <span
                key={initial}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand-ink ring-2 ring-card",
                  i > 0 && "-ml-2",
                )}
              >
                {initial}
              </span>
            ))}
          </dt>
          <dd className="text-sm text-muted-foreground">
            Owner, helper, office manager
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <dt className="text-base text-muted-foreground">Setup fee</dt>
          <dd className="text-base font-semibold text-ink">None</dd>
        </div>
      </dl>
    </Card>
  );
}

/* The same trigger → wait → condition → action chain the builder draws. The
   trigger is the one blue node (the fill, with white text at 5.6:1): it is the
   place the run starts, which is exactly what the one accent is for. */
const CHAIN = [
  { title: "Quote sent", kind: "Trigger", icon: IconBolt },
  { title: "Wait 3 days", kind: "Delay", icon: IconHourglassHigh },
  { title: "Only if not accepted", kind: "Condition", icon: IconFilter },
  { title: "Send reminder email", kind: "Action", icon: IconMail },
] as const;

function AutomationVisual() {
  return (
    <ol role="list" className="w-full max-w-md">
      {CHAIN.map((node, i) => {
        const isTrigger = i === 0;
        return (
          <li key={node.title}>
            <div
              className={cn(
                "flex items-center gap-4 rounded-lg border px-4 py-3.5 shadow-sm",
                isTrigger
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border bg-card text-card-foreground",
              )}
            >
              {isTrigger ? (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-foreground/15 text-brand-foreground">
                  <node.icon size={18} stroke={1.8} />
                </span>
              ) : (
                <IconDisc icon={node.icon} size="sm" className="h-9 w-9" />
              )}
              <div className="min-w-0">
                <p className="text-base font-semibold">{node.title}</p>
                <p
                  className={cn(
                    "text-sm",
                    isTrigger
                      ? "text-brand-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {node.kind}
                </p>
              </div>
            </div>
            {i < CHAIN.length - 1 ? (
              <span
                aria-hidden="true"
                className="ml-[2.125rem] block h-6 w-px bg-border"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function MarginVisual() {
  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Job margin
          </p>
          <p className="mt-1 text-lg font-semibold text-ink">Rivera Home</p>
        </div>
        <Pill tone="warning">Incomplete</Pill>
      </div>

      <div className="mt-6 flex items-baseline justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Revenue</span>
        <span className="tnum font-semibold text-ink">$2,400.00</span>
      </div>

      {/* Revenue is the full bar. Costs are solid because they are known; the
          margin segment is hatched because it is not: with a cost missing, the
          true margin can only be lower than this, so it is drawn as unfinished
          rather than as a clean number (PRODUCT.md → Unknown is not zero). */}
      <div className="mt-2 flex h-10 overflow-hidden rounded-md border border-border">
        <div className="h-full bg-input" style={{ width: "58%" }} />
        <div className="hatch-incomplete h-full flex-1" />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm bg-input"
            />
            Costs so far
          </dt>
          <dd className="tnum mt-1 text-lg font-semibold text-ink">
            $1,392.00
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className="hatch-incomplete h-2.5 w-2.5 rounded-sm"
            />
            Margin, at most
          </dt>
          <dd className="tnum mt-1 text-lg font-semibold text-ink">
            $1,008.00
          </dd>
        </div>
      </dl>

      <p className="mt-5 flex items-start gap-2.5 rounded-md border border-status-warning/60 bg-status-warning/10 px-3 py-2.5 text-sm text-ink">
        <IconAlertTriangle
          size={18}
          stroke={1.8}
          className="mt-px shrink-0"
          aria-hidden="true"
        />
        Incomplete: 2 line items have no cost
      </p>
    </Card>
  );
}

/* ── Rows ───────────────────────────────────────────────────────────────── */

/*
 * The three edges PRODUCT.md → Positioning claims that the page had not made
 * since the bento was removed: one flat price, automations on the CRM's own
 * records, and numbers that admit their gaps. Every line below is in that
 * file or in the Built list.
 *
 * "Team members: unlimited" in the ledger is the owner's wording. No seat cap
 * exists in the API or the schema (grepped 2026-10-18), but nothing in
 * PRODUCT.md says "unlimited", so confirm it before launch.
 */
const ROWS = [
  {
    key: "price",
    title: "One price for the whole business.",
    body: "$49 a month per business, not per user. Bring in a helper or an office manager and the price stays the same.",
    points: [
      "The owner, a helper and an office manager share one plan",
      "No setup fee and no contract",
    ],
    Visual: PriceVisual,
  },
  {
    key: "automations",
    title: "Automations that work from your own records.",
    body: "A quote goes out, three days pass with no answer, and a reminder is sent. The moment the customer accepts, it stops.",
    points: [
      "Starts from real events: a quote sent, a job completed, an invoice overdue",
      "Respects email consent and your working hours",
    ],
    Visual: AutomationVisual,
  },
  {
    key: "margins",
    title: "Numbers that admit their gaps.",
    body: "When a cost is missing, the job's margin says so instead of reading it as profit.",
    points: [
      "Hours come from timers and logged entries, not a number typed in later",
      "A profitability report across every job",
    ],
    Visual: MarginVisual,
  },
] as const;

/**
 * Why switch.
 *
 * Three full-width rows, text and picture alternating sides from `lg`, one per
 * positioning edge. They are rows, not a three-card grid: each claim needs a
 * picture at the size where it can be read, and the grid is the layout this
 * page leaned on hardest before.
 *
 * On a phone every row stacks text first, then picture, whichever side the
 * picture takes on a desk.
 */
export function DifferentiatorsSection() {
  return (
    <Section id="why-zaxvio" surface="alt" labelledBy="why-heading">
      <SectionHeading
        id="why-heading"
        title="Built around a crew of one to three."
        lede="Three choices that shape how Zaxvio is priced, automated and measured."
      />

      <div className="mt-16 space-y-20 lg:mt-20 lg:space-y-28">
        {ROWS.map((row, i) => {
          const flip = i % 2 === 1;
          return (
            <Reveal
              key={row.key}
              className="grid items-center gap-10 lg:grid-cols-12 lg:gap-x-12"
            >
              <div
                className={cn(
                  "lg:col-span-5 lg:row-start-1",
                  flip ? "lg:col-start-8" : "lg:col-start-1",
                )}
              >
                <h3 className="font-heading text-2xl font-bold leading-tight tracking-tight text-ink text-balance sm:text-3xl">
                  {row.title}
                </h3>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
                  {row.body}
                </p>
                <ul role="list" className="mt-6 space-y-3">
                  {row.points.map((point) => (
                    <li key={point} className="flex items-start gap-3">
                      <IconCheck
                        size={20}
                        stroke={2.5}
                        className="mt-0.5 shrink-0 text-brand-ink"
                        aria-hidden="true"
                      />
                      <span className="text-base text-ink">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                aria-hidden="true"
                className={cn(
                  "flex lg:col-span-6 lg:row-start-1",
                  flip
                    ? "lg:col-start-1 lg:justify-start"
                    : "lg:col-start-7 lg:justify-end",
                )}
              >
                <row.Visual />
              </div>
            </Reveal>
          );
        })}
      </div>

      <p className="mt-16 text-sm text-muted-foreground">
        Figures in these pictures are sample data.
      </p>
    </Section>
  );
}
