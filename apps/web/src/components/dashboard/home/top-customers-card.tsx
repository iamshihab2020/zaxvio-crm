"use client";

import Link from "next/link";
import { IconUsersGroup, IconArrowRight } from "@tabler/icons-react";
import type { DashboardTopCustomer } from "@hvac-saas/types";
import { formatCurrency } from "@/lib/format";

interface TopCustomersCardProps {
  data: DashboardTopCustomer[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function TopCustomersCard({ data }: TopCustomersCardProps) {
  const top = data.slice(0, 5);
  const max = top[0]?.revenue ?? 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Top Customers
        </h3>
        <Link
          href="/customers"
          className="inline-flex items-center gap-1 text-[11px] font-body text-muted-foreground hover:text-foreground cursor-pointer"
        >
          View all
          <IconArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {top.length === 0 ? (
        <div className="mt-4 flex-1 rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center">
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
        <ul className="mt-4 space-y-2">
          {top.map((c, i) => {
            const rel = max > 0 ? Math.max(4, Math.round((c.revenue / max) * 100)) : 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 transition-all hover:border-brand/40 hover:bg-brand/5 hover:shadow-sm cursor-pointer"
                >
                  {/* Rank + initials */}
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 font-heading text-xs font-semibold text-brand">
                    {initials(c.name) || "?"}
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 font-heading text-[10px] font-bold text-background">
                      {i + 1}
                    </span>
                  </div>

                  {/* Name + meter */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-heading text-sm font-semibold text-foreground">
                        {c.name}
                      </span>
                      <span className="whitespace-nowrap font-heading text-sm font-semibold text-foreground">
                        {formatCurrency(c.revenue)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/50">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${rel}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-[10px] font-body text-muted-foreground">
                        {c.jobCount} {c.jobCount === 1 ? "job" : "jobs"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
