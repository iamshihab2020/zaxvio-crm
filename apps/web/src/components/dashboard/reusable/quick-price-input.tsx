"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Put a price on a job, quote or invoice without itemising it.
 *
 * Plenty of work is quoted as one number — a lead logged at $500, a call-out at
 * $85 — and making someone open the line item form, pick a type, set a quantity
 * and name the thing before the number is accepted is four decisions to record
 * one. Here it is one field.
 *
 * It still creates a line item underneath, deliberately. A separate "flat
 * amount" on the record would mean two ways to hold money — a subtotal summed
 * from items *and* an override — and everything downstream (tax, the invoice
 * generated from a job, the PDF, the totals recalculation) would need to know
 * which was in play. The line item is the money model; this is a shortcut into
 * it, not a second one beside it. The row is fully editable afterwards.
 *
 * **A typed-but-uncommitted value must never be silently dropped.** The first
 * version only committed on Enter or the + button, so typing 500 and going
 * straight to "Create Job" created a job worth nothing — the number sat in a
 * field nobody read, with no error and no warning. Two defences: it commits on
 * blur, and it can be driven as a controlled input so the parent form can flush
 * whatever is still pending at submit time. Blur alone is not enough — clicking
 * the submit button races the state update.
 */
export function QuickPriceInput({
  onAdd,
  disabled,
  className,
  label = "Add a price",
  value: controlledValue,
  onValueChange,
}: {
  /** Called with a validated, positive decimal string. */
  onAdd: (price: string) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** Pass with `onValueChange` to let a parent form flush a pending value. */
  value?: string;
  onValueChange?: (next: string) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState("");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolled;

  const setValue = (next: string) => {
    if (isControlled) onValueChange?.(next);
    else setUncontrolled(next);
  };

  const [busy, setBusy] = useState(false);

  async function submit(source: "explicit" | "blur") {
    const trimmed = value.trim();
    if (!trimmed) return;

    const price = Number(trimmed);
    if (!Number.isFinite(price) || price < 0) {
      // Leaving the field with rubbish in it should not raise a toast the user
      // did not ask for; typing Enter should.
      if (source === "explicit") toast.error("Enter a price like 500 or 499.99");
      return;
    }

    setBusy(true);
    try {
      await onAdd(price.toFixed(2));
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            $
          </span>
          <Input
            inputMode="decimal"
            aria-label={label}
            placeholder={label}
            value={value}
            disabled={disabled || busy}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => void submit("blur")}
            // Enter must not reach the surrounding form, which would submit the
            // whole dialog instead of adding the line.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                void submit("explicit");
              }
            }}
            className="tnum h-8 pl-6 text-sm"
          />
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label={label}
          disabled={disabled || busy || !value.trim()}
          // `onMouseDown` rather than `onClick`: the input's blur handler fires
          // first and clears the field, so by click time there is nothing left
          // to add.
          onMouseDown={(e) => {
            e.preventDefault();
            void submit("explicit");
          }}
          className="h-8 w-8 shrink-0"
        >
          <IconPlus className="h-4 w-4" />
        </Button>
      </div>

      {value.trim() !== "" && (
        <p className="text-[11px] font-body text-muted-foreground">
          Press Enter to add it as a line
        </p>
      )}
    </div>
  );
}
