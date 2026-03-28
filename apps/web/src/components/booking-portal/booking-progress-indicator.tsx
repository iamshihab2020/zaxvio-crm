"use client";

import { cn } from "@/lib/utils";
import { IconCheck } from "@tabler/icons-react";

interface BookingProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const STEP_LABELS = ["Service", "Date", "Time", "Details", "Done"];

export function BookingProgressIndicator({
  currentStep,
  totalSteps,
}: BookingProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-between">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                  isCompleted && "bg-brand text-white",
                  isActive && "bg-brand text-white ring-4 ring-brand/20",
                  !isCompleted && !isActive && "bg-muted text-muted-foreground",
                )}
              >
                {isCompleted ? (
                  <IconCheck className="h-4 w-4" />
                ) : (
                  step
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium font-body transition-colors",
                  isActive
                    ? "text-brand"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {STEP_LABELS[i]}
              </span>
            </div>

            {/* Connector line */}
            {i < totalSteps - 1 && (
              <div className="flex-1 mx-2 mb-5">
                <div
                  className={cn(
                    "h-0.5 w-full rounded-full transition-colors duration-300",
                    isCompleted ? "bg-brand" : "bg-border",
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
