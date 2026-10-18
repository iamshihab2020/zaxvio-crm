"use client";

import Link from "next/link";
import { useRef } from "react";
import { IconUsersGroup } from "@tabler/icons-react";
import type { DashboardTopCustomer } from "@hvac-saas/types";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { tokenColor } from "@/lib/constants/chart-palette";
import { useStagger } from "@/hooks/use-stagger";
import { enterDelay } from "./chart-motion";
import { WidgetHeader, WidgetLink } from "./widget-header";

interface TopCustomersCardProps {
  data: DashboardTopCustomer[];
}

// The meter is a one-series bar chart, so it takes the series colour, not the
// UI brand (which runs brighter than `--chart-1` in dark mode).
const METER_COLOR = tokenColor("chart-1");

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** The meters draw in as the ranking is laid down, row by row. */
const METER_DELAY_BASE = 160;
const METER_STEP = 50;

export function TopCustomersCard({ data }: TopCustomersCardProps) {
  const top = data.slice(0, 5);
  const max = top[0]?.revenue ?? 0;

  // The ranking is who is on it, in order. A new range that reorders or
  // replaces the five re-lays the list; the same five with new revenue does
  // not (their meters re-size instead).
  const listRef = useRef<HTMLUListElement>(null);
  useStagger(listRef, top.length > 0 ? top.map((c) => c.id).join("|") : null);

  return (
    <Card data-widget="topCustomers" className="flex h-full flex-col p-4 sm:p-6">
      <WidgetHeader
        title="Top Customers"
        action={<WidgetLink href="/customers">View all →</WidgetLink>}
      />

      {top.length === 0 ? (
        <div className="motion-appear mt-4 flex-1 rounded-md border border-dashed border-border bg-muted/10 p-4 text-center sm:p-6">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <IconUsersGroup className="h-5 w-5 text-brand" />
          </div>
          <p className="mt-3 font-heading text-sm font-semibold text-foreground">
            No revenue yet
          </p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            Top customers by revenue will rank here.
          </p>
        </div>
      ) : (
        <ul ref={listRef} className="mt-4 space-y-2">
          {top.map((c, i) => {
            const rel = max > 0 ? Math.max(4, Math.round((c.revenue / max) * 100)) / 100 : 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-background/40 p-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
                >
                  {/* Rank + initials. The avatar is round (people are, in this
                      system) and the rank is a count, so it is a round badge on
                      its rim. */}
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 font-heading text-xs font-semibold text-brand-ink">
                    {initials(c.name) || "?"}
                    <span className="tnum absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 font-mono text-[10px] font-medium text-background">
                      {i + 1}
                    </span>
                  </div>

                  {/* Name + meter */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-heading text-sm font-semibold text-foreground">
                        {c.name}
                      </span>
                      <span className="tnum whitespace-nowrap font-mono text-sm font-medium text-foreground">
                        {formatCurrency(c.revenue)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/50">
                        {/* Full width, scaled to the share: it draws in and
                            re-sizes on `transform` alone. */}
                        <div
                          className="motion-grow-x h-full w-full rounded-full motion-safe:transition-transform motion-safe:[transition-duration:var(--dur-focal)] motion-safe:[transition-timing-function:var(--ease-out)]"
                          style={{
                            ...enterDelay(METER_DELAY_BASE + i * METER_STEP),
                            transform: `scaleX(${rel})`,
                            backgroundColor: METER_COLOR,
                          }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] font-body text-muted-foreground">
                        <span className="tnum font-mono">{c.jobCount}</span>{" "}
                        {c.jobCount === 1 ? "job" : "jobs"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
