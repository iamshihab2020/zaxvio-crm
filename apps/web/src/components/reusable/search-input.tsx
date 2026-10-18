"use client";

import { cn } from "@/lib/utils";
import { IconSearch } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: SearchInputProps) {
  return (
    <div
      className={cn(
        // In a wrapping row (ListToolbar) this is what keeps the box usable:
        // `basis-full` gives it a line of its own on a phone, and from `sm` the
        // 12rem floor makes the row wrap before the box can shrink to a sliver.
        // Outside a flex row (the automation step picker) the flex properties do
        // nothing and `max-w-none` still lets it fill its panel.
        "relative min-w-0 max-w-sm flex-1 basis-full sm:min-w-[12rem] sm:basis-56",
        className,
      )}
    >
      <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // The focus ring is a box-shadow, so the colour utility alone would let
        // it snap on while the border fades.
        className="pl-10 transition-[border-color,box-shadow] duration-200"
      />
    </div>
  );
}
