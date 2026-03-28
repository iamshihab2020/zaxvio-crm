"use client";

import { useState, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IconClock } from "@tabler/icons-react";

interface TimePickerProps {
  value: string; // "HH:mm" (24h) or ""
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

function parse24(time: string): { hour12: number; minute: number; period: "AM" | "PM" } {
  if (!time) return { hour12: 9, minute: 0, period: "AM" };
  const [h, m] = time.split(":").map(Number);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour12, minute: m ?? 0, period };
}

function to24(hour12: number, minute: number, period: "AM" | "PM"): string {
  let h = hour12;
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${h.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function formatDisplay(time: string): string {
  if (!time) return "";
  const { hour12, minute, period } = parse24(time);
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function ScrollColumn({
  items,
  value,
  onChange,
  format,
}: {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = itemRefs.current.get(value);
    if (el && containerRef.current) {
      const container = containerRef.current;
      const top = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
      container.scrollTo({ top, behavior: "instant" });
    }
  }, [value]);

  // Radix Popover can swallow wheel events — handle manually with smooth scrolling
  const scrollTargetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    scrollTargetRef.current = el.scrollTop;

    const handler = (e: WheelEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Accumulate target position
      scrollTargetRef.current += e.deltaY;
      scrollTargetRef.current = Math.max(
        0,
        Math.min(scrollTargetRef.current, el.scrollHeight - el.clientHeight),
      );

      // Animate smoothly via rAF
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const animate = () => {
        const current = el.scrollTop;
        const target = scrollTargetRef.current;
        const diff = target - current;

        if (Math.abs(diff) < 0.5) {
          el.scrollTop = target;
          return;
        }

        el.scrollTop = current + diff * 0.25;
        rafRef.current = requestAnimationFrame(animate);
      };

      rafRef.current = requestAnimationFrame(animate);
    };

    el.addEventListener("wheel", handler, { passive: false });
    return () => {
      el.removeEventListener("wheel", handler);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col py-1 h-[200px] overflow-y-auto overscroll-contain"
      style={{ scrollbarWidth: "none" }}
    >
      {items.map((item) => {
        const isSelected = item === value;
        return (
          <button
            key={item}
            ref={(el) => {
              if (el) itemRefs.current.set(item, el);
            }}
            type="button"
            onClick={() => onChange(item)}
            className={cn(
              "flex items-center justify-center h-9 w-12 rounded-lg text-sm transition-all cursor-pointer shrink-0",
              isSelected
                ? "bg-brand text-brand-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted font-medium",
            )}
          >
            {format(item)}
          </button>
        );
      })}
    </div>
  );
}

export function TimePicker({
  value,
  onChange,
  placeholder = "Pick time",
  id,
  disabled,
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const { hour12, minute, period } = parse24(value);
  const snappedMinute = Math.round(minute / 5) * 5 === 60 ? 55 : Math.round(minute / 5) * 5;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 cursor-pointer px-3",
            !value && "text-muted-foreground",
          )}
        >
          <IconClock className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{value ? formatDisplay(value) : placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start" sideOffset={4}>
        <div className="flex items-stretch gap-0">
          {/* Hours */}
          <ScrollColumn
            items={HOURS}
            value={hour12}
            onChange={(h) => onChange(to24(h, snappedMinute, period))}
            format={(v) => v.toString().padStart(2, "0")}
          />

          {/* Minutes */}
          <ScrollColumn
            items={MINUTES}
            value={snappedMinute}
            onChange={(m) => onChange(to24(hour12, m, period))}
            format={(v) => v.toString().padStart(2, "0")}
          />

          {/* AM/PM */}
          <div className="flex flex-col gap-1 py-1 pl-1">
            {(["AM", "PM"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onChange(to24(hour12, snappedMinute, p))}
                className={cn(
                  "flex items-center justify-center h-9 w-12 rounded-lg text-xs font-semibold transition-all cursor-pointer tracking-wide",
                  period === p
                    ? "bg-brand text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="w-full mt-1.5 pt-1.5 border-t border-border text-xs text-muted-foreground hover:text-foreground cursor-pointer text-center pb-0.5"
          >
            Clear
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
