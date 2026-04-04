"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  IconAdjustmentsHorizontal,
  IconLayoutSidebar,
  IconMaximize,
  IconExternalLink,
  IconCheck,
} from "@tabler/icons-react";
import type { ViewMode } from "@/hooks/use-view-preference";

/* ── Field definitions ─────────────────────────────────────── */

const CARD_FIELD_DEFS = [
  { key: "serviceType", label: "Service Type" },
  { key: "priority", label: "Priority" },
  { key: "jobNumber", label: "Job Number" },
  { key: "customer", label: "Customer" },
  { key: "address", label: "Address" },
  { key: "date", label: "Date" },
  { key: "time", label: "Time" },
  { key: "amount", label: "Amount" },
  { key: "todayBadge", label: "Today Badge" },
] as const;

export type CardFieldKey = (typeof CARD_FIELD_DEFS)[number]["key"];
export type CardFieldVisibility = Record<CardFieldKey, boolean>;

const STORAGE_KEY = "jobs-card-fields";

const DEFAULT_FIELDS: CardFieldVisibility = {
  serviceType: true,
  priority: true,
  jobNumber: true,
  customer: true,
  address: true,
  date: true,
  time: true,
  amount: true,
  todayBadge: true,
};

function loadFields(): CardFieldVisibility {
  if (typeof window === "undefined") return DEFAULT_FIELDS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_FIELDS, ...parsed };
    }
  } catch {
    // ignore
  }
  return DEFAULT_FIELDS;
}

/* ── Hook ──────────────────────────────────────────────────── */

export function useCardFieldVisibility() {
  const [fields, setFieldsState] = useState<CardFieldVisibility>(DEFAULT_FIELDS);

  useEffect(() => {
    setFieldsState(loadFields());
  }, []);

  const setField = useCallback((key: CardFieldKey, visible: boolean) => {
    setFieldsState((prev) => {
      const next = { ...prev, [key]: visible };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setFieldsState(DEFAULT_FIELDS);
  }, []);

  return { fields, setField, resetDefaults };
}

/* ── Unified Display Settings Popover ──────────────────────── */

const VIEW_MODE_OPTIONS: { mode: ViewMode; icon: typeof IconLayoutSidebar; label: string }[] = [
  { mode: "sidebar", icon: IconLayoutSidebar, label: "Sidebar" },
  { mode: "dialog", icon: IconMaximize, label: "Dialog" },
  { mode: "page", icon: IconExternalLink, label: "Full page" },
];

interface DisplaySettingsPopoverProps {
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
  fields: CardFieldVisibility;
  onFieldChange: (key: CardFieldKey, visible: boolean) => void;
  onFieldsReset: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  viewModeMounted: boolean;
}

export function DisplaySettingsPopover({
  compact,
  onCompactChange,
  fields,
  onFieldChange,
  onFieldsReset,
  viewMode,
  onViewModeChange,
  viewModeMounted,
}: DisplaySettingsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          hoverScale={1}
          tapScale={0.97}
          className="h-7 gap-1.5 px-2 text-xs font-body text-muted-foreground hover:text-foreground rounded-lg"
        >
          <IconAdjustmentsHorizontal className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Display</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        {/* Density section */}
        <div className="px-3 pt-3 pb-2">
          <p className="text-[11px] font-semibold text-muted-foreground font-heading uppercase tracking-wider mb-2">
            Density
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              hoverScale={1}
              tapScale={0.97}
              onClick={() => onCompactChange(false)}
              className={cn(
                "flex-1 h-7 rounded-md px-2.5 text-xs font-body font-medium",
                !compact
                  ? "bg-brand-light text-brand dark:bg-brand/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Default
            </Button>
            <Button
              variant="ghost"
              size="sm"
              hoverScale={1}
              tapScale={0.97}
              onClick={() => onCompactChange(true)}
              className={cn(
                "flex-1 h-7 rounded-md px-2.5 text-xs font-body font-medium",
                compact
                  ? "bg-brand-light text-brand dark:bg-brand/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Compact
            </Button>
          </div>
        </div>

        <div className="h-px bg-border/60 mx-3" />

        {/* Detail view mode section */}
        {viewModeMounted && (
          <>
            <div className="px-3 pt-2 pb-2">
              <p className="text-[11px] font-semibold text-muted-foreground font-heading uppercase tracking-wider mb-2">
                Detail View
              </p>
              <div className="space-y-0.5">
                {VIEW_MODE_OPTIONS.map(({ mode, icon: Icon, label }) => (
                  <Button
                    key={mode}
                    variant="ghost"
                    size="sm"
                    hoverScale={1}
                    tapScale={0.97}
                    onClick={() => onViewModeChange(mode)}
                    className={cn(
                      "flex w-full items-center gap-2 h-7 rounded-md px-2 text-xs font-body justify-start",
                      viewMode === mode
                        ? "bg-brand-light/30 text-brand dark:bg-brand/15"
                        : "text-foreground hover:bg-muted/50",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 text-left">{label}</span>
                    {viewMode === mode && (
                      <IconCheck className="h-3 w-3 text-brand shrink-0" />
                    )}
                  </Button>
                ))}
              </div>
            </div>

            <div className="h-px bg-border/60 mx-3" />
          </>
        )}

        {/* Card fields section */}
        <div className="px-3 pt-2 pb-2">
          <p className="text-[11px] font-semibold text-muted-foreground font-heading uppercase tracking-wider mb-2">
            Card Fields
          </p>
          <div className="space-y-0.5">
            {CARD_FIELD_DEFS.map((def) => (
              <label
                key={def.key}
                className="flex items-center justify-between rounded-md px-2 py-1 text-xs font-body hover:bg-muted/50 cursor-pointer"
              >
                <span className="text-foreground">{def.label}</span>
                <Switch
                  checked={fields[def.key]}
                  onCheckedChange={(checked) => onFieldChange(def.key, checked)}
                  className="scale-[0.65]"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            hoverScale={1}
            tapScale={0.97}
            onClick={onFieldsReset}
            className="w-full h-6 rounded-md text-[11px] text-muted-foreground hover:text-foreground font-body"
          >
            Reset to defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
