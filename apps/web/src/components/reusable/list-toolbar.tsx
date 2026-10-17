import type { ReactNode } from "react";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListToolbarProps {
  /** Filter tabs (and anything that narrows the list), left-aligned. */
  filters?: ReactNode;
  /** Search and the controls that act on the list, pushed right. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The header row of a list page's card: filter tabs on the left, search and
 * buttons on the right.
 *
 * Nine pages hand-copied this row and the copies drifted. Most had no
 * `flex-wrap`, so on a phone the right-hand controls were pushed past the
 * card's edge, where its `overflow-hidden` (there to round the table's corners)
 * cut them off. One component means one answer.
 *
 * From `sm` it is the single row of The One Row Rule: filters left, actions
 * pushed right, wrapping to a second line only when the two cannot fit. On a
 * phone it stacks, the documented exception: 311px has no room for tabs, a
 * search box and three 40px buttons side by side. Filters become one line that
 * scrolls sideways and runs to the card's edges, so a half-visible tab reads as
 * "more this way"; the actions sit below, `SearchInput` on a line of its own and
 * the buttons after it.
 */
export function ListToolbar({ filters, actions, className }: ListToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {filters && (
        // `[&>*]:shrink-0`: a tab group, a divider or a chip squeezed to fit
        // would defeat the point of letting this row scroll. The scrollbar is
        // hidden because the cut-off tab is the cue, and a 10px bar under a
        // 36px track reads as a second control.
        <div className="-mx-4 flex items-center gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 sm:mx-0 sm:max-w-full sm:px-0">
          {filters}
        </div>
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}

interface ListToolbarCreateButtonProps {
  /** "Add Customer", "New Invoice": the verb stays visible from `sm`. */
  label: string;
  onClick: () => void;
  className?: string;
}

/**
 * The list page's primary action. Below `sm` it is a 40px icon button at the
 * end of the actions row (the label would take a third of a phone's width);
 * from `sm` it is the labelled 32px button every list page used to build by hand.
 */
export function ListToolbarCreateButton({
  label,
  onClick,
  className,
}: ListToolbarCreateButtonProps) {
  return (
    <Button
      onClick={onClick}
      size="sm"
      aria-label={label}
      className={cn(
        "ml-auto h-10 w-10 shrink-0 bg-brand px-0 font-body text-brand-foreground hover:bg-brand/90 sm:h-8 sm:w-auto sm:px-3",
        className,
      )}
    >
      <IconPlus className="sm:mr-1.5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
