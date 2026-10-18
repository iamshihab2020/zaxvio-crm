import { cn } from "@/lib/utils";
import { Reveal } from "./reveal";

/**
 * The landing page's two structural primitives.
 *
 * `Section` owns the surface band and the vertical rhythm, so the light/dark
 * alternation is decided in one place instead of being retyped, and mistyped,
 * on every section. `SectionHeading` owns the section header.
 *
 * The header used to open with a full-width hairline, a small left-aligned
 * heading and an empty right half, ten times over. That was the retired "work
 * order" brand's ruled-paper motif, and as a page it read as one sparse rhythm
 * with no hierarchy. The rule is gone. At `lg` the header is now two columns:
 * the heading on the left at display weight, the lede on the right and
 * bottom-aligned to the heading's last line, so a short lede sits level with
 * the baseline instead of floating under a tall heading. Below `lg` they stack.
 * `layout="stacked"` keeps them in one column for a section that puts the
 * heading in a narrow side rail (the FAQ).
 *
 * There is no eyebrow option. A `label` prop used to put a mono uppercase
 * kicker above the heading; it began as required, so all ten sections rendered
 * one by construction, and that single templated rhythm was the page's loudest
 * generic signature. It is gone so it cannot drift back in. The heading
 * carries its own weight.
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
      className={cn("py-20 lg:py-28", SURFACE[surface], className)}
    >
      <div className="mx-auto w-full max-w-[88rem] px-5 sm:px-6 lg:px-8">
        {children}
      </div>
    </section>
  );
}

export function SectionHeading({
  id,
  title,
  lede,
  action,
  tone = "light",
  layout = "split",
  className,
}: {
  id: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** A control that belongs with the lede (a "see all" button). */
  action?: React.ReactNode;
  /** `dark` when the section sits on the midnight slab. */
  tone?: "light" | "dark";
  /** `split` puts the lede beside the heading from `lg`; `stacked` never does. */
  layout?: "split" | "stacked";
  className?: string;
}) {
  const isDark = tone === "dark";
  const isSplit = layout === "split";

  return (
    <Reveal
      className={cn(
        isSplit && "lg:grid lg:grid-cols-12 lg:items-end lg:gap-x-12",
        className,
      )}
    >
      <h2
        id={id}
        className={cn(
          "font-heading text-3xl font-bold leading-[1.1] tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]",
          isSplit && "lg:col-span-7",
          isDark ? "text-midnight-foreground" : "text-ink",
        )}
      >
        {title}
      </h2>

      {lede || action ? (
        <div className={cn("mt-4", isSplit && "lg:col-span-5 lg:mt-0")}>
          {lede ? (
            <p
              className={cn(
                "max-w-xl text-lg leading-relaxed text-pretty",
                isDark ? "text-midnight-foreground/70" : "text-muted-foreground",
              )}
            >
              {lede}
            </p>
          ) : null}
          {action ? <div className={lede ? "mt-5" : undefined}>{action}</div> : null}
        </div>
      ) : null}
    </Reveal>
  );
}
