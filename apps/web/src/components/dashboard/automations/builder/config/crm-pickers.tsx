"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconCheck, IconSelector, IconX } from "@tabler/icons-react";
import { isBlank, SERVICE_TYPES } from "@hvac-saas/workflow-nodes";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FieldWrapper } from "./field-wrapper";
import type { PickerFieldProps } from "./fields";
import { searchWorkflowRecords, type RecordOption } from "@/actions/workflows";
import { cn } from "@/lib/utils";

/**
 * The P7 CRM pickers.
 *
 * Split from `fields.tsx` — which is already 765 lines — rather than appended,
 * because these divide cleanly on one axis the primitives do not have: whether
 * the options are **preloaded or searched**.
 *
 * - **Bounded** (tags, checklists, catalog items, service types, other
 *   automations) come down with `builder-context` on node open. They are bounded
 *   by how a business is *configured*.
 * - **Searchable** (customers, jobs, equipment, contracts) are bounded by how
 *   long the business has *existed*, so they query. Preloading them would make
 *   opening a node slower every year a tenant stays.
 *
 * Every one of them stores an **id**, never a label. A picker that stored the
 * display string would break the moment a customer was renamed, and would
 * silently match nothing rather than erroring.
 */

const TRIGGER_CLASS =
  "font-body text-left [&>span]:flex-1 [&>span]:text-left [&>span]:truncate";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * "We only loaded the first 200" — shown, never swallowed.
 *
 * A truncated list that says nothing is indistinguishable from a complete one,
 * and the author's conclusion is that the row they wanted has been deleted.
 */
function TruncationNotice({
  context,
  listName,
}: {
  context: { truncated: string[] } | null;
  listName: string;
}) {
  if (!context?.truncated.includes(listName)) return null;
  return (
    <p className="text-[11px] leading-snug text-muted-foreground font-body">
      Showing the first 200. If what you need isn&rsquo;t here, rename it to sort
      earlier or pick it on the record itself.
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounded — options ship with builder-context
// ─────────────────────────────────────────────────────────────────────────────

export function TagField({
  property,
  value,
  onChange,
  disabled,
  context,
  contextLoading,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);
  const tags = context?.tags ?? [];

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={asString(value)}
        onValueChange={onChange}
        disabled={disabled || contextLoading}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue
            placeholder={contextLoading ? "Loading tags…" : "Choose a tag"}
          />
        </SelectTrigger>
        <SelectContent>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tag.color ?? "var(--muted-foreground)" }}
                />
                <span className="font-body">{tag.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!contextLoading && tags.length === 0 && (
        <p className="text-[11px] text-amber-600 font-body dark:text-amber-500">
          No tags yet — create one on a customer first.
        </p>
      )}
      <TruncationNotice context={context} listName="tags" />
    </FieldWrapper>
  );
}

/** Several tags at once. Stores an array of ids, and an empty array is a value. */
export function MultiTagField({
  property,
  value,
  onChange,
  disabled,
  context,
  contextLoading,
}: PickerFieldProps) {
  const selected = asStringArray(value);
  const invalid = !!property.required && selected.length === 0;
  const tags = context?.tags ?? [];

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  }

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={`field-${property.name}`}
            variant="outline"
            role="combobox"
            disabled={disabled || contextLoading}
            className={cn(
              "w-full justify-between font-body font-normal",
              invalid && "border-amber-500/50",
            )}
          >
            <span className="truncate text-left">
              {selected.length === 0
                ? contextLoading
                  ? "Loading tags…"
                  : "Choose tags"
                : `${selected.length} tag${selected.length === 1 ? "" : "s"}`}
            </span>
            <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags…" className="font-body" />
            <CommandList>
              <CommandEmpty className="py-4 text-center text-sm font-body">
                No tags found.
              </CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => toggle(tag.id)}
                    className="font-body"
                  >
                    <IconCheck
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(tag.id) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span
                      aria-hidden
                      className="mr-2 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color ?? "var(--muted-foreground)" }}
                    />
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const tag = tags.find((t) => t.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1 font-body font-normal">
                {tag?.name ?? "Unknown tag"}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  disabled={disabled}
                  className="rounded-sm opacity-60 hover:opacity-100"
                  aria-label={`Remove ${tag?.name ?? "tag"}`}
                >
                  <IconX className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <TruncationNotice context={context} listName="tags" />
    </FieldWrapper>
  );
}

export function ChecklistField({
  property,
  value,
  onChange,
  disabled,
  context,
  contextLoading,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);
  const checklists = context?.checklists ?? [];

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={asString(value)}
        onValueChange={onChange}
        disabled={disabled || contextLoading}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue
            placeholder={contextLoading ? "Loading checklists…" : "Choose a checklist"}
          />
        </SelectTrigger>
        <SelectContent>
          {checklists.map((list) => (
            <SelectItem key={list.id} value={list.id}>
              <span className="font-body">{list.name}</span>
              {list.serviceType && (
                <span className="ml-2 text-xs text-muted-foreground font-body">
                  {list.serviceType.replace(/_/g, " ")}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!contextLoading && checklists.length === 0 && (
        <p className="text-[11px] text-amber-600 font-body dark:text-amber-500">
          No active checklists — add one in Settings → Checklists first.
        </p>
      )}
      <TruncationNotice context={context} listName="checklists" />
    </FieldWrapper>
  );
}

export function CatalogItemField({
  property,
  value,
  onChange,
  disabled,
  context,
  contextLoading,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);
  const items = context?.catalogItems ?? [];

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={asString(value)}
        onValueChange={onChange}
        disabled={disabled || contextLoading}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue
            placeholder={contextLoading ? "Loading your catalog…" : "Choose an item"}
          />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              <span className="font-body">{item.name}</span>
              {item.unitPrice && (
                <span className="ml-2 text-xs tabular-nums text-muted-foreground font-body">
                  ${item.unitPrice}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!contextLoading && items.length === 0 && (
        <p className="text-[11px] text-amber-600 font-body dark:text-amber-500">
          Your catalog is empty — add a service or part first.
        </p>
      )}
      <TruncationNotice context={context} listName="catalogItems" />
    </FieldWrapper>
  );
}

/**
 * The service type enum.
 *
 * Was a **declared property type with no case in the renderer**, so any node
 * using it drew "this kind of field isn't available yet". The values come from
 * the shared package rather than being retyped — a filter offering options the
 * payload's enum does not contain matches nothing, silently, which is the exact
 * failure the declarative design exists to prevent.
 */
export function ServiceTypeField({
  property,
  value,
  onChange,
  disabled,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select value={asString(value)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue placeholder="Choose a service type" />
        </SelectTrigger>
        <SelectContent>
          {SERVICE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              <span className="font-body capitalize">{type.replace(/_/g, " ")}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}

/**
 * Another automation, for `workflow.run`.
 *
 * The automation being edited is excluded server-side. An inactive one is still
 * offered, with a marker: a sub-run is driven by its parent, so "switched off"
 * means "does not trigger on its own", not "cannot be called". Hiding them would
 * make a deliberately-manual sub-automation unpickable.
 */
export function WorkflowField({
  property,
  value,
  onChange,
  disabled,
  context,
  contextLoading,
}: PickerFieldProps) {
  const invalid = !!property.required && isBlank(value);
  const workflows = context?.workflows ?? [];

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Select
        value={asString(value)}
        onValueChange={onChange}
        disabled={disabled || contextLoading}
      >
        <SelectTrigger
          id={`field-${property.name}`}
          className={cn(TRIGGER_CLASS, invalid && "border-amber-500/50")}
        >
          <SelectValue
            placeholder={
              contextLoading ? "Loading automations…" : "Choose an automation"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {workflows.map((flow) => (
            <SelectItem key={flow.id} value={flow.id}>
              <span className="font-body">{flow.name}</span>
              {!flow.isActive && (
                <span className="ml-2 text-xs text-muted-foreground font-body">
                  off
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!contextLoading && workflows.length === 0 && (
        <p className="text-[11px] text-muted-foreground font-body">
          You have no other automations to call yet.
        </p>
      )}
    </FieldWrapper>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Searchable — options come from the server as you type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One searchable picker, parameterised by kind.
 *
 * ## The saved-value problem
 *
 * A saved config holds an id and nothing else. On open there is no search term
 * to find its label with, so the control would render a bare uuid — or, worse,
 * an empty trigger, which reads as *unconfigured* on a step that is configured
 * and would be "fixed" by picking something else. The `ids` rehydrate on mount
 * is what stops that, and it runs exactly once per value.
 *
 * ## Debounced, and cancelled
 *
 * Every keystroke would otherwise be a request, and — worse than the load — the
 * responses can arrive out of order, so a slow result for "sm" lands after "smith"
 * and replaces the right list with a stale one. The generation counter drops any
 * response that is not from the newest query.
 */
function SearchablePicker({
  property,
  value,
  onChange,
  disabled,
  nodeId: _nodeId,
  workflowId,
  kind,
  placeholder,
  emptyHint,
}: PickerFieldProps & {
  workflowId: string;
  kind: string;
  placeholder: string;
  emptyHint: string;
}) {
  const selectedId = asString(value);
  const invalid = !!property.required && !selectedId;

  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<RecordOption[]>([]);
  const [loading, setLoading] = useState(false);
  // The label for the *saved* id, kept apart from `options` so a search that
  // does not contain it cannot blank out the trigger.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const generation = useRef(0);

  // Rehydrate. Keyed on the id, so it re-runs when a different value is chosen
  // from outside (a version restore, an undo) and not on every render.
  useEffect(() => {
    if (!selectedId) {
      setSelectedLabel(null);
      return;
    }
    let cancelled = false;
    void searchWorkflowRecords(workflowId, { kind, ids: [selectedId] }).then((res) => {
      if (cancelled) return;
      const found = res.data?.[0];
      // A saved id whose row has since been deleted. Said plainly rather than
      // left blank — "no longer exists" is actionable, an empty box is not.
      setSelectedLabel(found?.label ?? "No longer exists");
    });
    return () => {
      cancelled = true;
    };
  }, [workflowId, kind, selectedId]);

  useEffect(() => {
    if (!open) return;
    const mine = ++generation.current;
    setLoading(true);
    const timer = setTimeout(() => {
      void searchWorkflowRecords(workflowId, { kind, q: term }).then((res) => {
        // Out-of-order guard: a slow response for an older term must not replace
        // the list for the term the user is actually looking at.
        if (mine !== generation.current) return;
        setOptions(res.data ?? []);
        setLoading(false);
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [open, term, workflowId, kind]);

  const triggerText = useMemo(() => {
    if (selectedId) return selectedLabel ?? "Loading…";
    return placeholder;
  }, [selectedId, selectedLabel, placeholder]);

  return (
    <FieldWrapper property={property} invalid={invalid}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={`field-${property.name}`}
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-body font-normal",
              !selectedId && "text-muted-foreground",
              invalid && "border-amber-500/50",
            )}
          >
            <span className="truncate text-left">{triggerText}</span>
            <IconSelector className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={term}
              onValueChange={setTerm}
              className="font-body"
            />
            <CommandList>
              {loading ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : (
                <>
                  <CommandEmpty className="py-4 text-center text-sm font-body">
                    {emptyHint}
                  </CommandEmpty>
                  <CommandGroup>
                    {options.map((option) => (
                      <CommandItem
                        key={option.id}
                        value={option.id}
                        onSelect={() => {
                          onChange(option.id);
                          setSelectedLabel(option.label);
                          setOpen(false);
                        }}
                        className="font-body"
                      >
                        <IconCheck
                          className={cn(
                            "mr-2 h-4 w-4 shrink-0",
                            option.id === selectedId ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{option.label}</span>
                          {option.sublabel && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {option.sublabel}
                            </span>
                          )}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedId && (
        <button
          type="button"
          onClick={() => onChange("")}
          disabled={disabled}
          className="self-start text-[11px] text-muted-foreground underline-offset-2 hover:underline font-body"
        >
          Clear
        </button>
      )}
    </FieldWrapper>
  );
}

export function CustomerField(props: PickerFieldProps & { workflowId: string }) {
  return (
    <SearchablePicker
      {...props}
      kind="customer"
      placeholder="Search customers by name or email"
      emptyHint="No customers match that."
    />
  );
}

export function JobField(props: PickerFieldProps & { workflowId: string }) {
  return (
    <SearchablePicker
      {...props}
      kind="job"
      placeholder="Search jobs by title or number"
      emptyHint="No jobs match that."
    />
  );
}

export function EquipmentField(props: PickerFieldProps & { workflowId: string }) {
  return (
    <SearchablePicker
      {...props}
      kind="equipment"
      placeholder="Search assets by make, model or serial"
      emptyHint="No assets match that."
    />
  );
}

export function ContractField(props: PickerFieldProps & { workflowId: string }) {
  return (
    <SearchablePicker
      {...props}
      kind="contract"
      placeholder="Search service agreements"
      emptyHint="No agreements match that."
    />
  );
}
