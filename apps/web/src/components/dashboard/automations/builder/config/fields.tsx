"use client";

import { IconInfoCircle, IconAlertTriangle, IconPlus, IconX } from "@tabler/icons-react";
import {
  isBlank,
  variablesForSubject,
  type NodePropertyOption,
} from "@hvac-saas/workflow-nodes";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FieldWrapper, type FieldProps } from "./field-wrapper";
import { VariableInput } from "./variable-input";
import { cn } from "@/lib/utils";
import type { BuilderContext } from "@/actions/workflows";

/**
 * The field renderers.
 *
 * Each one renders a control and nothing else — label, description, required
 * marker and hint all come from `FieldWrapper`. That is what keeps adding a
 * field type cheap, and it is what makes "add a node definition and it renders"
 * true rather than aspirational.
 *
 * **Every control writes through `onChange` immediately.** Debouncing happens
 * one level up, in the panel, so the value on screen is never behind what the
 * user typed while the write to the store is still batched.
 */

/**
 * Shared trigger styling for every picker in the panel.
 *
 * `[&>span]:flex-1` + `text-left` is the load-bearing part. The trigger is
 * `justify-between` with two children — the value and the chevron — so a value
 * narrower than the control leaves a gap on both sides of it and the label
 * reads as centred. Letting the value span take the free space pins it left,
 * where every other label and input in the form starts.
 */
const TRIGGER_CLASS =
  "font-body text-left [&>span]:flex-1 [&>span]:text-left [&>span]:truncate";

// ─────────────────────────────────────────────────────────────────────────────
// Text-ish
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Whether a field can take `{{variables}}`.
 *
 * `noInterpolate` is on the definition for fields whose contents are handed to
 * something else that owns `{}` — a regex, a raw body. Offering a picker there
 * would be offering to insert something that stays literal, which is worse than
 * not offering it at all.
 */
function acceptsVariables(property: FieldProps["property"]): boolean {
  return !property.noInterpolate;
}

export function StringField({
  property,
  value,
  onChange,
  disabled,
  subject,
}: FieldProps) {
  const invalid = !!property.required && isBlank(value);
  const text = typeof value === "string" ? value : "";

  return (
    <FieldWrapper property={property} invalid={invalid}>
      {acceptsVariables(property) ? (
        <VariableInput
          id={`field-${property.name}`}
          value={text}
          onChange={onChange}
          placeholder={property.placeholder}
          disabled={disabled}
          invalid={invalid}
          subject={subject}
        />
      ) : (
        <Input
          id={`field-${property.name}`}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.placeholder}
          disabled={disabled}
          className={cn("font-body", invalid && "border-amber-500/50")}
        />
      )}
    </FieldWrapper>
  );
}

export function TextField({
  property,
  value,
  onChange,
  disabled,
  subject,
}: FieldProps) {
  const invalid = !!property.required && isBlank(value);
  const text = typeof value === "string" ? value : "";
  const rows = property.typeOptions?.rows ?? 4;

  return (
    <FieldWrapper property={property} invalid={invalid}>
      {acceptsVariables(property) ? (
        <VariableInput
          id={`field-${property.name}`}
          value={text}
          onChange={onChange}
          placeholder={property.placeholder}
          disabled={disabled}
          invalid={invalid}
          multiline
          rows={rows}
          subject={subject}
        />
      ) : (
        <Textarea
          id={`field-${property.name}`}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={property.placeholder}
          rows={rows}
          disabled={disabled}
          className={cn("font-body", invalid && "border-amber-500/50")}
        />
      )}
    </FieldWrapper>
  );
}

export function NumberField({ property, value, onChange, disabled }: FieldProps) {
  const invalid = !!property.required && isBlank(value);
  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Input
        id={`field-${property.name}`}
        type="number"
        // `""` rather than `0` for an empty numeric field. Writing 0 would make
        // "no minimum" indistinguishable from "minimum zero", which is the same
        // class of bug as treating 0 as unset in a filter.
        value={typeof value === "number" ? String(value) : ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
        min={property.typeOptions?.minValue}
        max={property.typeOptions?.maxValue}
        step={property.typeOptions?.step}
        placeholder={property.placeholder}
        disabled={disabled}
        className={cn("font-mono", invalid && "border-amber-500/50")}
      />
    </FieldWrapper>
  );
}

/**
 * Money. Held as a **number** and rendered with the currency beside it, not
 * inside it — a formatted string in the value is a string the engine then has
 * to parse, and parsing money is where rounding errors are born.
 */
export function MoneyField({ property, value, onChange, disabled }: FieldProps) {
  const invalid = !!property.required && isBlank(value);
  return (
    <FieldWrapper property={property} invalid={invalid}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">
          $
        </span>
        <Input
          id={`field-${property.name}`}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={typeof value === "number" ? String(value) : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? undefined : Number(e.target.value))
          }
          placeholder={property.placeholder ?? "0.00"}
          disabled={disabled}
          className={cn("pl-7 font-mono", invalid && "border-amber-500/50")}
        />
      </div>
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Choice
// ─────────────────────────────────────────────────────────────────────────────

export function BooleanField({ property, value, onChange, disabled }: FieldProps) {
  return (
    <FieldWrapper property={property} inline>
      <Switch
        id={`field-${property.name}`}
        checked={value === true}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </FieldWrapper>
  );
}

export function OptionsField({ property, value, onChange, disabled }: FieldProps) {
  const invalid = !!property.required && isBlank(value);
  const options = property.options ?? [];

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={value === undefined || value === null ? "" : String(value)}
        onValueChange={(next) => onChange(coerceToOption(next, options))}
        disabled={disabled}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue placeholder={property.placeholder ?? "Choose one"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={String(option.value)}
              value={String(option.value)}
              // Passed as a prop, not as a child: children are mirrored into
              // the closed trigger, and a description there turns the control
              // into two stacked lines.
              description={option.description}
            >
              <span className="font-body">{option.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

/**
 * Multi-select as toggle chips rather than a dropdown with checkboxes.
 *
 * These lists are short and closed (seven service types), and what the user
 * needs to see is *which are on* — a dropdown hides that behind a click and
 * summarises it as "3 selected", which answers the wrong question.
 *
 * An empty selection means **no filter**, not "match nothing". Said out loud
 * below the chips, because the opposite reading is the dangerous one.
 */
export function MultiOptionsField({ property, value, onChange, disabled }: FieldProps) {
  const selected = Array.isArray(value) ? (value as unknown[]).map(String) : [];
  const options = property.options ?? [];

  function toggle(option: NodePropertyOption) {
    const key = String(option.value);
    const next = selected.includes(key)
      ? selected.filter((v) => v !== key)
      : [...selected, key];
    onChange(next.map((v) => coerceToOption(v, options)));
  }

  return (
    <FieldWrapper property={property}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = selected.includes(String(option.value));
          return (
            <button
              key={String(option.value)}
              type="button"
              disabled={disabled}
              onClick={() => toggle(option)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors font-body",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                active
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border text-muted-foreground hover:border-input hover:text-foreground",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              {option.name}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-[11px] text-muted-foreground font-body">
          Nothing selected — this runs for all of them.
        </p>
      )}
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Time
// ─────────────────────────────────────────────────────────────────────────────

export function DateField({ property, value, onChange, disabled }: FieldProps) {
  const invalid = !!property.required && isBlank(value);
  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Input
        id={`field-${property.name}`}
        type="date"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn("font-mono", invalid && "border-amber-500/50")}
      />
    </FieldWrapper>
  );
}

export function TimeField({ property, value, onChange, disabled }: FieldProps) {
  const invalid = !!property.required && isBlank(value);
  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Input
        id={`field-${property.name}`}
        type="time"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn("font-mono", invalid && "border-amber-500/50")}
      />
    </FieldWrapper>
  );
}

const DURATION_UNITS = ["minutes", "hours", "days", "weeks"] as const;
type DurationUnit = (typeof DURATION_UNITS)[number];
interface DurationValue {
  amount?: number;
  unit?: DurationUnit;
}

/** `{ amount, unit }` — never a raw millisecond count. A stored 172800000 is
 *  unreadable in a database row and ambiguous across a DST boundary. */
export function DurationField({ property, value, onChange, disabled }: FieldProps) {
  const current = (value ?? {}) as DurationValue;
  const units = (property.typeOptions?.units ?? DURATION_UNITS) as readonly DurationUnit[];

  return (
    <FieldWrapper property={property}>
      <div className="flex gap-2">
        <Input
          id={`field-${property.name}`}
          type="number"
          min={1}
          value={typeof current.amount === "number" ? String(current.amount) : ""}
          onChange={(e) =>
            onChange({
              ...current,
              amount: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
          disabled={disabled}
          className="w-24 font-mono"
        />
        <Select
          value={current.unit ?? units[0]}
          onValueChange={(unit) => onChange({ ...current, unit: unit as DurationUnit })}
          disabled={disabled}
        >
          <SelectTrigger className={cn("flex-1", TRIGGER_CLASS)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Structured
// ─────────────────────────────────────────────────────────────────────────────

interface KeyValueRow {
  key: string;
  value: string;
}

export function KeyValueField({ property, value, onChange, disabled }: FieldProps) {
  const rows: KeyValueRow[] = Array.isArray(value) ? (value as KeyValueRow[]) : [];
  const opts = property.typeOptions;

  function update(index: number, patch: Partial<KeyValueRow>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <FieldWrapper property={property}>
      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={index} className="flex gap-1.5">
            <Input
              value={row.key ?? ""}
              onChange={(e) => update(index, { key: e.target.value })}
              placeholder={opts?.keyPlaceholder ?? "Name"}
              disabled={disabled}
              className="flex-1 font-mono text-sm"
            />
            <Input
              value={row.value ?? ""}
              onChange={(e) => update(index, { value: e.target.value })}
              placeholder={opts?.valuePlaceholder ?? "Value"}
              disabled={disabled}
              className="flex-1 font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground"
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
              disabled={disabled}
              aria-label={`Remove ${row.key || "row"}`}
            >
              <IconX className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-body"
          onClick={() => onChange([...rows, { key: "", value: "" }])}
          disabled={disabled}
        >
          <IconPlus className="mr-1.5 h-3.5 w-3.5" />
          {opts?.addButtonText ?? "Add"}
        </Button>
      </div>
    </FieldWrapper>
  );
}

/** Display only — carries no value, and is skipped by the constructor and the
 *  required-field check alike. */
export function NoticeField({ property }: FieldProps) {
  const kind = property.typeOptions?.noticeType ?? "info";
  const Icon = kind === "info" ? IconInfoCircle : IconAlertTriangle;

  return (
    <div
      className={cn(
        "flex gap-2 rounded-md border px-3 py-2.5",
        kind === "error"
          ? "border-destructive/40 bg-destructive/5"
          : kind === "warning"
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border bg-muted/40",
      )}
    >
      <Icon
        className={cn(
          "mt-px h-4 w-4 shrink-0",
          kind === "error"
            ? "text-destructive"
            : kind === "warning"
              ? "text-amber-500"
              : "text-muted-foreground",
        )}
      />
      <p className="text-xs leading-snug font-body">
        {property.typeOptions?.noticeMessage ?? property.description}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM pickers — fed by the one batch request, never their own fetch
// ─────────────────────────────────────────────────────────────────────────────

export interface PickerFieldProps extends FieldProps {
  context: BuilderContext | null;
  contextLoading: boolean;
}

export function MemberField({
  property,
  value,
  onChange,
  disabled,
  context,
  contextLoading,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);
  const members = context?.members ?? [];

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        disabled={disabled || contextLoading}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue
            placeholder={contextLoading ? "Loading your team…" : "Choose a teammate"}
          />
        </SelectTrigger>
        <SelectContent>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              <span className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={member.image ?? undefined} alt="" />
                  <AvatarFallback className="text-[9px]">
                    {initials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-body">{member.name || member.email}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!contextLoading && members.length === 0 && (
        <p className="text-[11px] text-amber-600 font-body dark:text-amber-500">
          No teammates yet — invite someone in Settings → Team first.
        </p>
      )}
    </FieldWrapper>
  );
}

export function PipelineField({
  property,
  value,
  onChange,
  disabled,
  context,
  contextLoading,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);
  const pipelines = context?.pipelines ?? [];

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        disabled={disabled || contextLoading}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue
            placeholder={contextLoading ? "Loading pipelines…" : "Any pipeline"}
          />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((pipeline) => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              <span className="font-body">{pipeline.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

/**
 * Stages, filtered by the sibling `pipelineId` (C-4).
 *
 * `dependsOn` names the sibling in the definition rather than being hardcoded
 * here, so a second stage picker on a different node works without touching
 * this file.
 */
export function StageField({
  property,
  value,
  onChange,
  disabled,
  siblings,
  context,
  contextLoading,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);
  const dependsOn = property.typeOptions?.dependsOn ?? "pipelineId";
  const pipelineId = siblings[dependsOn];
  const stages = (context?.stages ?? []).filter(
    (stage) => typeof pipelineId !== "string" || stage.pipelineId === pipelineId,
  );

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={onChange}
        disabled={disabled || contextLoading || typeof pipelineId !== "string"}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue
            placeholder={
              typeof pipelineId === "string" ? "Choose a stage" : "Pick a pipeline first"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {stages.map((stage) => (
            <SelectItem key={stage.id} value={stage.id}>
              <span className="flex items-center gap-2">
                <span className="font-body">{stage.label}</span>
                {/* The lifecycle chip is what stops "Awaiting parts" being
                    picked when the author meant a completed stage. */}
                <span className="rounded border border-border px-1 py-px font-mono text-[10px] leading-none text-muted-foreground">
                  {stage.lifecycle.replace(/_/g, " ")}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Radix `Select` deals only in strings, but a definition's option values may be
 * numbers or booleans — and writing "true" where the engine expects `true` is a
 * filter that silently never matches. Map back through the declared options.
 */
function coerceToOption(raw: string, options: NodePropertyOption[]) {
  const match = options.find((option) => String(option.value) === raw);
  return match ? match.value : raw;
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/*
 * There is deliberately **no debounce layer here.**
 *
 * [[wf-08-builder-frontend|C-5]] asks for one, and it turned out to be
 * redundant: every write lands in a Zustand store in the same tab, which is
 * cheap, and the reason to debounce — not putting one undo entry on the stack
 * per keystroke — is already handled by the store coalescing edits on
 * `(nodeId, field)`. A second timer here would only add a window where the
 * control shows one value and the node badge reflects another.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Date variable
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick a date the record carries, by name.
 *
 * The value stored is a bare variable **path** — `booking.date` — not a rendered
 * date and not a `{{token}}`. That is what lets "wait until the day before the
 * appointment" mean a different instant on every run, and it is why this is a
 * dropdown rather than a text input with a variable picker beside it: the
 * executor resolves the raw value, so a hand-typed `{{booking.date}}` would
 * arrive already rendered as "Aug 12, 2026" and be unreadable as a date.
 *
 * Scoped by `variablesForSubject`, so a booking-triggered automation is never
 * offered the invoice due date — a wait that could never resolve is the one
 * failure this control exists to prevent.
 */
export function DateVariableField({
  property,
  value,
  onChange,
  disabled,
  subject,
}: FieldProps) {
  const allowed = property.typeOptions?.variableTypes ?? ["date", "datetime"];
  const options = variablesForSubject(subject).filter((variable) =>
    (allowed as readonly string[]).includes(variable.type),
  );

  const invalid = !!property.required && isBlank(value);
  const current = typeof value === "string" ? value : "";

  // A trigger that carries no dates at all. Said plainly and with the cause,
  // because the fix is upstream — change the trigger — and an empty dropdown
  // reads as a bug in the dropdown.
  if (options.length === 0) {
    return (
      <FieldWrapper property={property} invalid={invalid}>
        <div className="rounded-md border border-dashed border-border px-3 py-2.5">
          <p className="text-[11px] leading-snug text-muted-foreground font-body">
            This trigger doesn&rsquo;t carry any dates, so there is nothing to wait
            for. Waiting for a length of time works from any trigger.
          </p>
        </div>
      </FieldWrapper>
    );
  }

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={current}
        onValueChange={(next) => onChange(next)}
        disabled={disabled}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue placeholder={property.placeholder ?? "Choose a date"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((variable) => (
            <SelectItem
              key={variable.path}
              value={variable.path}
              // The sample, not the description: "Aug 12, 2026" answers "is this
              // the field I mean" faster than a sentence about it does.
              description={`e.g. ${variable.sample}`}
            >
              <span className="font-body">{variable.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}
