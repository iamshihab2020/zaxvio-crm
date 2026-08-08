"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import { buildPalette, isActive } from "@hvac-saas/workflow-nodes";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/reusable/search-input";
import { useBuilderStore } from "@/lib/workflow/store";
import { resolveNodeIcon } from "@/lib/workflow/icon-map";
import { cn } from "@/lib/utils";

/**
 * The step picker.
 *
 * **A panel, not a modal.** It sits in the builder's layout and pushes the
 * canvas aside rather than covering it, and it **stays open after a pick**.
 * Building an automation is a run of several steps, and a sheet that dismissed
 * itself on every choice turned a five-step build into five open/close cycles —
 * which is what a first pass here got wrong.
 *
 * Keeping the canvas visible also means the step you just added is on screen
 * while you choose the next one, so the graph grows in front of you instead of
 * being revealed each time the overlay closes.
 *
 * It is still **contextual** (L-1): opened from a trigger affordance it offers
 * triggers, opened from a `+` it offers actions. That never became a flat
 * "everything" list.
 */
export function NodePalettePanel() {
  const open = useBuilderStore((s) => s.paletteOpen);
  const mode = useBuilderStore((s) => s.paletteMode);
  const close = useBuilderStore((s) => s.closePalette);
  const addFromPalette = useBuilderStore((s) => s.addFromPalette);

  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  // Clear the query each time it opens, not when it closes: a stale filter is
  // the reason "the step I wanted isn't here" — and clearing on close is
  // visible during the transition.
  useEffect(() => {
    if (open) setSearch("");
  }, [open, mode]);

  // Escape closes, matching the sheet it replaces. Scoped to the panel so it
  // does not swallow Escape from the config drawer or a dialog above it.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // `buildPalette` groups, orders and resolves colour inside the package, so
  // the ordering rules live beside the data they order.
  const groups = useMemo(
    () => buildPalette({ mode, search: search || undefined }),
    [mode, search],
  );

  const empty = groups.every((g) => g.subgroups.every((s) => s.nodes.length === 0));

  return (
    <aside
      // Width animates to zero rather than unmounting, so the canvas resize is
      // one smooth motion instead of a jump. `aria-hidden` when closed keeps the
      // collapsed content out of the tab order.
      aria-hidden={!open}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-r border-border bg-card",
        "transition-[width] duration-200 ease-out motion-reduce:transition-none",
        open ? "w-[300px]" : "w-0 border-r-0",
      )}
    >
      <div className="flex w-[300px] flex-1 flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold">
              {mode === "trigger" ? "What starts this?" : "What happens next?"}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground font-body">
              {mode === "trigger"
                ? "Pick the event that sets it off."
                : "Pick the step to run at this point."}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 -mt-1 h-7 w-7 shrink-0"
            onClick={close}
            aria-label="Close the step picker"
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>

        <div ref={searchRef} className="border-b border-border px-4 py-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search steps..."
            className="max-w-none"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {empty && (
            <p className="px-1 py-10 text-center text-sm text-muted-foreground font-body">
              Nothing matches &ldquo;{search}&rdquo;.
            </p>
          )}

          {groups.map((group) => (
            <div key={group.category} className="mb-5 last:mb-0">
              {group.subgroups.map((sub) =>
                sub.nodes.length === 0 ? null : (
                  <div key={sub.id} className="mb-4 last:mb-0">
                    {/* The dashboard's section-label pattern, used 63 times
                        elsewhere. This read as ordinary body text before, which
                        is why the palette looked like it belonged to a
                        different application than the panel beside it. */}
                    <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
                      {sub.label}
                    </p>
                    <ul className="space-y-0.5">
                      {sub.nodes.map((entry, entryIndex) => {
                        const Icon = resolveNodeIcon(entry.icon);
                        // O-4: coming-soon steps are greyed, not hidden. It
                        // signals the roadmap and answers "does this do X?".
                        const available = isActive(entry.node);

                        return (
                          <li
                            key={entry.node}
                            className="animate-panel-item"
                            // Staggered, and capped: past ~10 rows the delay
                            // stops reading as a cascade and starts reading as
                            // the list being slow to load.
                            style={
                              {
                                "--enter-delay": `${Math.min(entryIndex, 10) * 22}ms`,
                              } as React.CSSProperties
                            }
                          >
                            <button
                              type="button"
                              disabled={!available}
                              onClick={() => addFromPalette(entry.node)}
                              // The row mirrors the node it places — same tinted
                              // icon tile, same name-over-description stack — so
                              // choosing is recognising rather than reading, and
                              // nothing about the canvas is a surprise on drop.
                              className={cn(
                                "flex w-full items-start gap-2.5 rounded-md border px-2 py-2 text-left transition-colors",
                                available
                                  ? "border-transparent hover:border-border hover:bg-muted focus-visible:border-border focus-visible:bg-muted focus-visible:outline-none"
                                  : "cursor-not-allowed border-transparent opacity-45",
                              )}
                            >
                              <span
                                aria-hidden
                                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                                style={{
                                  backgroundColor: `${entry.color}22`,
                                  color: entry.color,
                                }}
                              >
                                <Icon className="h-[18px] w-[18px]" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="font-heading text-sm font-semibold">
                                    {entry.displayName}
                                  </span>
                                  {!available && (
                                    <span className="rounded border border-border px-1 py-px font-mono text-[10px] leading-none text-muted-foreground">
                                      soon
                                    </span>
                                  )}
                                </span>
                                {/* O-5: the one-line description is always
                                    visible, not on hover — a tooltip is
                                    unreachable by touch. */}
                                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground font-body">
                                  {entry.description}
                                </span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
