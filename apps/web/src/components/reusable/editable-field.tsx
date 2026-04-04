"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { IconPencil, IconCheck } from "@tabler/icons-react";

/* ── Shared types ──────────────────────────────────────────── */

interface EditableBaseProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/* ── EditableText ──────────────────────────────────────────── */

interface EditableTextProps extends EditableBaseProps {
  value: string;
  onSave: (value: string) => Promise<void>;
}

export function EditableText({
  value,
  onSave,
  placeholder = "Click to edit",
  disabled,
  className,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleSave = useCallback(async () => {
    setEditing(false);
    if (draft === value) return;
    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      setDraft(value);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draft, value, onSave]);

  if (disabled) {
    return (
      <span className={cn("text-sm text-foreground font-body", className)}>
        {value || <span className="text-muted-foreground/40">{placeholder}</span>}
      </span>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="h-7 text-sm"
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          hoverScale={1}
          tapScale={0.95}
          onMouseDown={(e) => { e.preventDefault(); handleSave(); }}
          className="shrink-0 h-6 w-6 text-brand hover:text-brand/80"
        >
          <IconCheck className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      hoverScale={1}
      tapScale={0.97}
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-center gap-1 text-left hover:text-brand h-auto p-0",
        saving && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <span className={value ? "text-sm text-foreground font-body" : "text-sm text-muted-foreground/40 font-body"}>
        {value || placeholder}
      </span>
      <IconPencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </Button>
  );
}

/* ── EditableTextarea ──────────────────────────────────────── */

interface EditableTextareaProps extends EditableBaseProps {
  value: string;
  onSave: (value: string) => Promise<void>;
}

export function EditableTextarea({
  value,
  onSave,
  placeholder = "Click to edit",
  disabled,
  className,
}: EditableTextareaProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editing]);

  const handleSave = useCallback(async () => {
    setEditing(false);
    if (draft === value) return;
    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      setDraft(value);
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [draft, value, onSave]);

  if (disabled) {
    return (
      <span className={cn("text-sm text-foreground font-body whitespace-pre-wrap", className)}>
        {value || <span className="text-muted-foreground/40">{placeholder}</span>}
      </span>
    );
  }

  if (editing) {
    return (
      <div className="space-y-1">
        <Textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setDraft(value); setEditing(false); }
          }}
          className="min-h-[60px] text-sm resize-none"
          placeholder={placeholder}
        />
        <p className="text-[10px] text-muted-foreground">Click outside or press Escape to cancel</p>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      hoverScale={1}
      tapScale={0.97}
      onClick={() => setEditing(true)}
      className={cn(
        "group inline-flex items-start gap-1 text-left hover:text-brand h-auto p-0 w-full justify-start",
        saving && "opacity-50 pointer-events-none",
        className,
      )}
    >
      <span className={cn(
        "text-sm font-body whitespace-pre-wrap text-left",
        value ? "text-foreground" : "text-muted-foreground/40",
      )}>
        {value || placeholder}
      </span>
      <IconPencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0 mt-1" />
    </Button>
  );
}

/* ── EditableSelect ────────────────────────────────────────── */

interface SelectOption {
  value: string;
  label: string;
  className?: string;
}

interface EditableSelectProps extends EditableBaseProps {
  value: string;
  options: SelectOption[];
  onSave: (value: string) => Promise<void>;
  renderValue?: (value: string, option: SelectOption | undefined) => React.ReactNode;
}

export function EditableSelect({
  value,
  options,
  onSave,
  placeholder = "Select",
  disabled,
  className,
  renderValue,
}: EditableSelectProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentOption = options.find((o) => o.value === value);

  async function handleSelect(newValue: string) {
    setOpen(false);
    if (newValue === value) return;
    setSaving(true);
    try {
      await onSave(newValue);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return (
      <span className={cn("text-sm text-foreground font-body", className)}>
        {currentOption?.label ?? value}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          hoverScale={1}
          tapScale={0.97}
          className={cn(
            "group inline-flex items-center gap-1 text-left hover:text-brand h-auto p-0",
            saving && "opacity-50 pointer-events-none",
            className,
          )}
        >
          {renderValue ? (
            renderValue(value, currentOption)
          ) : (
            <span className="text-sm text-foreground font-body">
              {currentOption?.label ?? value ?? placeholder}
            </span>
          )}
          <IconPencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        {options.map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            hoverScale={1}
            tapScale={0.97}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "flex w-full items-center gap-2 h-8 rounded-md px-2 text-sm font-body justify-start",
              option.value === value
                ? "bg-brand-light/30 text-brand dark:bg-brand/15"
                : "text-foreground",
              option.className,
            )}
          >
            <span className="flex-1 text-left">{option.label}</span>
            {option.value === value && (
              <IconCheck className="h-3.5 w-3.5 text-brand shrink-0" />
            )}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ── EditableDate ──────────────────────────────────────────── */

interface EditableDateProps extends EditableBaseProps {
  value: string; // ISO date string YYYY-MM-DD
  onSave: (value: string) => Promise<void>;
  formatDisplay?: (dateStr: string) => string;
}

function defaultFormatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function EditableDate({
  value,
  onSave,
  placeholder = "Select date",
  disabled,
  className,
  formatDisplay = defaultFormatDate,
}: EditableDateProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedDate = value ? new Date(value + "T00:00:00") : undefined;

  async function handleSelect(date: Date | undefined) {
    if (!date) return;
    const iso = date.toLocaleDateString("en-CA"); // YYYY-MM-DD
    setOpen(false);
    if (iso === value) return;
    setSaving(true);
    try {
      await onSave(iso);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return (
      <span className={cn("text-sm text-foreground font-body", className)}>
        {value ? formatDisplay(value) : placeholder}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          hoverScale={1}
          tapScale={0.97}
          className={cn(
            "group inline-flex items-center gap-1 text-left hover:text-brand h-auto p-0",
            saving && "opacity-50 pointer-events-none",
            className,
          )}
        >
          <span className={value ? "text-sm text-foreground font-body" : "text-sm text-muted-foreground/40 font-body"}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          <IconPencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── EditableTime ──────────────────────────────────────────── */

interface EditableTimeProps extends EditableBaseProps {
  value: string | null; // HH:mm 24h format
  onSave: (value: string) => Promise<void>;
}

function formatTime12h(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const amPm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${amPm}`;
}

export function EditableTime({
  value,
  onSave,
  placeholder = "Set time",
  disabled,
  className,
}: EditableTimeProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  async function handleChange(newValue: string) {
    setOpen(false);
    if (newValue === value) return;
    setSaving(true);
    try {
      await onSave(newValue);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (disabled) {
    return (
      <span className={cn("text-sm text-foreground font-body", className)}>
        {value ? formatTime12h(value) : placeholder}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          hoverScale={1}
          tapScale={0.97}
          className={cn(
            "group inline-flex items-center gap-1 text-left hover:text-brand h-auto p-0",
            saving && "opacity-50 pointer-events-none",
            className,
          )}
        >
          <span className={value ? "text-sm text-foreground font-body" : "text-sm text-muted-foreground/40 font-body"}>
            {value ? formatTime12h(value) : placeholder}
          </span>
          <IconPencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <input
          ref={inputRef}
          type="time"
          defaultValue={value ?? ""}
          onChange={(e) => {
            if (e.target.value) handleChange(e.target.value);
          }}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-body focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </PopoverContent>
    </Popover>
  );
}
