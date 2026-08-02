import {
  IconCalendarCheck,
  IconChartBar,
  IconFileText,
  IconLayoutKanban,
  IconReceipt,
  IconUsers,
} from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Reveal } from "./reveal";
import { Section, SectionHeading } from "./section";

/* ── Inline visuals ─────────────────────────────────────────────────────
   Each featured card carries a small diagram of the thing it describes,
   drawn with the same tokens as the rest of the page. These used to sit on
   hardcoded `bg-midnight` slabs with `text-white/40` labels, which meant two
   of the six cards ignored the theme entirely and read as holes in light
   mode.
   ──────────────────────────────────────────────────────────────────────── */

function KanbanVisual() {
  /* The three column dots were `sky-500`, `brand` and `emerald-500`. Two of
     those were the page's only use of their hue, so a diagram inside one card
     was setting a third and fourth accent colour for the whole site. They also
     conveyed nothing the column heading above them did not already say. */
  const columns = [
    { label: "Scheduled", cards: ["Johnson AC", "Smith Heat"] },
    { label: "On site", cards: ["Park Office"] },
    { label: "Done", cards: ["Rivera", "Chen", "Lee"] },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-hidden="true">
      {columns.map((col) => (
        <div key={col.label} className="min-w-0">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {col.label}
            </span>
            <span className="tnum ml-auto font-mono text-[10px] text-muted-foreground/60">
              {col.cards.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {col.cards.map((card) => (
              <div
                key={card}
                className="truncate rounded-md border border-border bg-surface-alt px-2 py-1.5 text-[11px] font-medium text-muted-foreground"
              >
                {card}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* `ChartVisual` was deleted here. It drew a twelve-bar revenue chart from a
   hardcoded array and labelled it "+18%" in emerald. Both numbers were
   invented, the growth figure was the page's only claim of a business outcome
   we cannot support, and the emerald was a fifth accent colour. The card it
   sat in keeps its copy and its grid span, so the bento cell count is
   unchanged. */

function BookingVisual() {
  const slots = ["08:00", "09:30", "11:00", "13:30", "15:00", "16:30"];
  const taken = new Set(["09:30", "15:00"]);
  return (
    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
      {slots.map((slot) => (
        <span
          key={slot}
          className={
            taken.has(slot)
              ? "tnum rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground/50 line-through"
              : "tnum rounded-md border border-brand/40 bg-brand/10 px-2.5 py-1.5 font-mono text-[11px] font-medium text-brand"
          }
        >
          {slot}
        </span>
      ))}
    </div>
  );
}

/* ── Cards ──────────────────────────────────────────────────────────────── */

function FeatureCard({
  icon: Icon,
  title,
  description,
  visual,
  className,
  delay,
}: {
  icon: typeof IconReceipt;
  title: string;
  description: string;
  visual?: React.ReactNode;
  className?: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className={className}>
      <Card className="flex h-full flex-col transition-colors duration-200 hover:border-brand/40">
        <CardHeader className="space-y-0 p-5 sm:p-6">
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <Icon size={19} stroke={1.6} aria-hidden="true" />
          </span>
          <CardTitle className="font-heading text-base font-semibold text-ink">
            {title}
          </CardTitle>
          <CardDescription className="pt-1.5 text-sm leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        {visual ? (
          <CardContent className="mt-auto p-5 pt-0 sm:p-6 sm:pt-0">
            {visual}
          </CardContent>
        ) : null}
      </Card>
    </Reveal>
  );
}

export function FeaturesSection() {
  return (
    <Section id="features" surface="base" labelledBy="features-heading">
      <SectionHeading
        id="features-heading"
        title="Everything you need. Nothing you don't."
        lede="Six tools that cover the whole job, from the first call to the paid invoice."
      />

      <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-6">
        <FeatureCard
          className="md:col-span-4"
          delay={0}
          icon={IconLayoutKanban}
          title="Job board"
          description="Every job on one board: scheduled, on site, done. Drag a card to move it; the customer gets told automatically."
          visual={<KanbanVisual />}
        />
        <FeatureCard
          className="md:col-span-2"
          delay={60}
          icon={IconChartBar}
          title="Revenue analytics"
          description="What you earned, what's outstanding, and which services actually pay."
        />
        <FeatureCard
          className="md:col-span-2"
          delay={120}
          icon={IconReceipt}
          title="Invoicing"
          description="Bill on site the moment the job is done. Customers pay from the email."
        />
        <FeatureCard
          className="md:col-span-2"
          delay={180}
          icon={IconFileText}
          title="Quotes"
          description="Send a branded quote in minutes. When it's accepted, it becomes a job in one tap."
        />
        <FeatureCard
          className="md:col-span-2"
          delay={240}
          icon={IconUsers}
          title="Customer history"
          description="Every past job, note, photo and piece of equipment, on the customer's record."
        />
        <FeatureCard
          className="md:col-span-6"
          delay={300}
          icon={IconCalendarCheck}
          title="Customers book themselves"
          description="Share one link. They see your real availability and pick a slot. No phone tag, and nothing double-booked."
          visual={
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <BookingVisual />
              <Badge
                variant="secondary"
                className="w-fit gap-1.5 px-3 py-1.5 font-mono text-[11px]"
              >
                zaxvio.com/book/your-business
              </Badge>
            </div>
          }
        />
      </div>
    </Section>
  );
}
