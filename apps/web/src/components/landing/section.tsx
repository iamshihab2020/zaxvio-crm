import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * The landing page's two structural primitives.
 *
 * `Section` owns the surface band and the vertical rhythm, so the light/dark
 * alternation is decided in one place instead of being retyped — and mistyped —
 * on every section. `SectionHeading` owns the ruled header.
 *
 * The rule is the page's structural device: a mono label sitting on a hairline
 * that runs to the right edge, the way a field is labelled on a work order.
 * It is left-aligned on purpose. Centred headings read as a brochure; this
 * audience reads the page one-handed on a phone, where a left edge to scan
 * down is worth more than symmetry.
 */

type Surface = "base" | "alt" | "dark";

const SURFACE: Record<Surface, string> = {
  base: "bg-surface text-ink",
  alt: "bg-surface-alt text-ink",
  dark: "bg-midnight text-midnight-foreground",
};

export function Section({
  id,
  surface = "base",
  labelledBy,
  className,
  children,
}: {
  id?: string;
  surface?: Surface;
  labelledBy?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("py-16 sm:py-20 lg:py-24", SURFACE[surface], className)}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  id,
  label,
  title,
  lede,
  tone = "light",
  className,
}: {
  id: string;
  /** Mono eyebrow that sits on the rule. */
  label: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** `dark` when the section sits on the midnight slab. */
  tone?: "light" | "dark";
  className?: string;
}) {
  const isDark = tone === "dark";

  return (
    <Reveal className={className}>
      {/* The rule spans the full container, not the text column. Stopping it at
          the prose width made it read as an underline that had run out rather
          than as the sheet's ruling, and it disagreed with every full-width
          element below it. */}
      <div className="flex items-center gap-4">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-brand">
          {label}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "h-px flex-1",
            isDark ? "bg-midnight-foreground/15" : "bg-border",
          )}
        />
      </div>

      <div className="max-w-2xl">
        <h2
          id={id}
          className={cn(
            "mt-5 font-heading text-[1.75rem] font-bold leading-[1.15] tracking-tight text-balance sm:text-4xl",
            isDark ? "text-midnight-foreground" : "text-ink",
          )}
        >
          {title}
        </h2>

        {lede ? (
          <p
            className={cn(
              "mt-3 text-base leading-relaxed text-pretty sm:text-lg",
              isDark ? "text-midnight-foreground/60" : "text-muted-foreground",
            )}
          >
            {lede}
          </p>
        ) : null}
      </div>
    </Reveal>
  );
}
