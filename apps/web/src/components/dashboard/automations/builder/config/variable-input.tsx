"use client";

import { useRef } from "react";
import type { SubjectType } from "@hvac-saas/workflow-nodes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VariablePicker } from "./variable-picker";
import { cn } from "@/lib/utils";

/**
 * A text field that can have `{{variables}}` dropped into it.
 *
 * **Inserted at the caret, not appended.** Appending is the easy version and it
 * is wrong for the field this exists for: an email body where the variable
 * belongs in the middle of a sentence. Getting the caret back afterwards
 * matters just as much — the user is mid-sentence, and a picker that leaves
 * focus in the popover makes them click back into the field every time.
 *
 * The button sits *inside* single-line fields and *above* multi-line ones. In a
 * textarea an overlaid button covers the text at exactly the point where the
 * content is longest.
 */

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Multi-line renders a textarea and moves the picker above it. */
  multiline?: boolean;
  rows?: number;
  /** What the trigger provides, so the picker only offers resolvable paths. */
  subject: SubjectType | null;
}

export function VariableInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  invalid,
  multiline,
  rows = 4,
  subject,
}: Props) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  function insert(token: string) {
    const el = ref.current;

    // No element yet — the field was never focused. Append, which is the only
    // sensible reading of "put it in" when there is no caret to speak of.
    if (!el) {
      onChange(value + token);
      return;
    }

    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    onChange(value.slice(0, start) + token + value.slice(end));

    // The caret has to be restored AFTER React re-renders with the new value,
    // or it is set on the old text and then reset to the end. One frame is
    // enough and does not need an effect.
    const caret = start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  const fieldClass = cn("font-body", invalid && "border-amber-500/50");

  if (multiline) {
    return (
      <div className="space-y-1.5">
        <div className="flex justify-end">
          <VariablePicker subject={subject} onInsert={insert} disabled={disabled} />
        </div>
        <Textarea
          id={id}
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={fieldClass}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        id={id}
        ref={ref as React.RefObject<HTMLInputElement>}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        // Padded so typed text never runs under the button.
        className={cn(fieldClass, "pr-9")}
      />
      <VariablePicker
        subject={subject}
        onInsert={insert}
        disabled={disabled}
        className="absolute right-1.5 top-1/2 -translate-y-1/2"
      />
    </div>
  );
}
