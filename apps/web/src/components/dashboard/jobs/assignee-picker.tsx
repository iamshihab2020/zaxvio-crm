"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconUserCircle, IconCheck, IconSelector } from "@tabler/icons-react";

export interface AssigneeMember {
  id: string;
  name: string;
  image: string | null;
  email: string;
}

interface AssigneePickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  members: AssigneeMember[];
  disabled?: boolean;
  className?: string;
  /** Show avatar-only trigger (no text) — for kanban cards */
  compact?: boolean;
  /** Render as a full-width outline form field — for create/edit dialogs */
  asFormField?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  const first = parts[0]?.charAt(0)?.toUpperCase() ?? "";
  const last = parts[1]?.charAt(0)?.toUpperCase() ?? "";
  return first + last || "?";
}

function MemberAvatar({
  member,
  size = "sm",
}: {
  member: AssigneeMember;
  size?: "sm" | "xs";
}) {
  const sizeClasses = size === "sm" ? "h-6 w-6 text-[10px]" : "h-5 w-5 text-[9px]";

  if (member.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={member.image}
        alt={member.name}
        className={cn("rounded-full object-cover shrink-0", sizeClasses)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-light/40 font-semibold text-brand dark:bg-brand/20 dark:text-brand",
        sizeClasses,
      )}
    >
      {getInitials(member.name)}
    </span>
  );
}

export function AssigneePicker({
  value,
  onChange,
  members,
  disabled,
  className,
  compact,
  asFormField,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);

  const selected = members.find((m) => m.id === value) ?? null;

  function handleSelect(id: string | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {compact ? (
          <button
            disabled={disabled}
            title={selected ? selected.name : "No assignee"}
            className={cn(
              "flex items-center justify-center rounded-full transition-opacity hover:opacity-80 focus:outline-none shrink-0",
              disabled && "pointer-events-none opacity-50",
              className,
            )}
          >
            {selected ? (
              <MemberAvatar member={selected} size="xs" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/60 hover:border-brand/50 hover:text-brand/70 transition-colors">
                <IconUserCircle className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        ) : asFormField ? (
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal font-body",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {selected ? (
                <>
                  <MemberAvatar member={selected} size="xs" />
                  <span className="truncate">{selected.name}</span>
                </>
              ) : (
                <>
                  <IconUserCircle className="h-4 w-4 shrink-0" />
                  <span>No assignee</span>
                </>
              )}
            </span>
            <IconSelector className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className={cn(
              "h-7 gap-1.5 px-2 text-xs font-body rounded-lg",
              selected
                ? "text-foreground hover:bg-muted/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              className,
            )}
          >
            {selected ? (
              <>
                <MemberAvatar member={selected} size="xs" />
                <span className="truncate">{selected.name}</span>
              </>
            ) : (
              <>
                <IconUserCircle className="h-4 w-4 shrink-0" />
                <span>No assignee</span>
              </>
            )}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        {/* No assignee option */}
        <button
          onClick={() => handleSelect(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-body hover:bg-muted/60 transition-colors",
            !value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <IconUserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left">No assignee</span>
          {!value && <IconCheck className="h-3 w-3 text-brand shrink-0" />}
        </button>

        {members.length > 0 && (
          <div className="h-px bg-border/60 my-1" />
        )}

        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => handleSelect(m.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-body hover:bg-muted/60 transition-colors",
              value === m.id ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <MemberAvatar member={m} size="xs" />
            <span className="flex-1 text-left truncate">{m.name}</span>
            {value === m.id && (
              <IconCheck className="h-3 w-3 text-brand shrink-0" />
            )}
          </button>
        ))}

        {members.length === 0 && (
          <p className="px-2 py-2 text-[11px] text-muted-foreground text-center">
            No team members yet
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
