import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * Small pieces the landing page's example UI is drawn from.
 *
 * The hero's quote and invoice cards, the booking-to-paid snippets and the
 * three "why" visuals all show the product's own furniture (a status pill, a
 * round icon disc, a bordered card). They live here so the page draws one pill
 * and one disc, in tokens, instead of five slightly different ones, and so a
 * change to how the app renders either is made in a single place.
 *
 * Everything here is illustration. Callers mark the whole visual
 * `aria-hidden` and carry the information in text beside it.
 */

type PillTone = "good" | "warning" | "brand" | "neutral";

/* `-ink` text on a 10% tint: the status colours clear 5:1 that way in both
   themes (DESIGN.md → Status). The fill step is never used for words, and
   amber has no ink step at all: warning is a fill, so its words are plain ink. */
const PILL_TONE: Record<PillTone, string> = {
  good: "bg-status-good/10 text-status-good-ink",
  warning: "bg-status-warning/20 text-ink",
  brand: "bg-brand-light text-brand-ink",
  neutral: "bg-muted text-muted-foreground",
};

/** A state pill: Accepted, Paid, Scheduled. Pills mean state, nothing else. */
export function Pill({
  tone,
  withCheck = false,
  className,
  children,
}: {
  tone: PillTone;
  withCheck?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        PILL_TONE[tone],
        className,
      )}
    >
      {withCheck ? <IconCheck size={12} stroke={3} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

const DISC_SIZE = {
  sm: { box: "h-8 w-8", icon: 16 },
  md: { box: "h-10 w-10", icon: 20 },
  lg: { box: "h-12 w-12", icon: 24 },
} as const;

/** A round icon disc: blue tint, blue icon (the stats-card disc in the app). */
export function IconDisc({
  icon: Icon,
  size = "md",
  className,
}: {
  icon: typeof IconCheck;
  size?: keyof typeof DISC_SIZE;
  className?: string;
}) {
  const { box, icon } = DISC_SIZE[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-ink",
        box,
        className,
      )}
    >
      <Icon size={icon} stroke={1.8} />
    </span>
  );
}

/** The bordered 8px card every example snippet sits in. Resting shadow only. */
export function MiniCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-3.5 text-card-foreground shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A real-looking checkbox for the example checklist. Never interactive. */
export function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border",
        checked
          ? "border-brand bg-brand text-brand-foreground"
          : "border-input bg-card",
      )}
    >
      {checked ? <IconCheck size={12} stroke={3.5} /> : null}
    </span>
  );
}
