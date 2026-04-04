"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FilterOption {
  value: string;
  label: string;
}

interface StatusFilterTabsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function StatusFilterTabs({
  options,
  value,
  onChange,
  className,
}: StatusFilterTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const updateIndicator = useCallback(() => {
    const activeTab = tabRefs.current.get(value);
    const container = containerRef.current;
    if (activeTab && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    }
  }, [value]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full bg-muted/60 p-1",
        className,
      )}
    >
      {indicator && (
        <div
          className="absolute rounded-full bg-brand transition-all duration-300 ease-in-out"
          style={{
            left: indicator.left,
            width: indicator.width,
            top: 4,
            bottom: 4,
          }}
        />
      )}
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <Button
            key={opt.value}
            ref={(el) => {
              if (el) {
                tabRefs.current.set(opt.value, el);
              } else {
                tabRefs.current.delete(opt.value);
              }
            }}
            variant="ghost"
            size="sm"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 rounded-full px-3 py-1 text-xs font-medium font-body h-auto transition-colors duration-200",
              isActive
                ? "text-brand-foreground hover:bg-transparent hover:text-brand-foreground"
                : "text-muted-foreground hover:bg-transparent hover:text-foreground",
            )}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}
