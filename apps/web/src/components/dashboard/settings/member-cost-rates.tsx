"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCurrencyDollar } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "@/components/dashboard/settings/settings-section";
import { formatMoney } from "@/lib/format";
import {
  useMemberRates,
  useSetMemberRate,
  useClearMemberRate,
} from "@/hooks/queries";

/**
 * Per-person hourly cost.
 *
 * Every member is listed, not only the ones with a saved row — the useful
 * question is "who is still on the default", and a list of exceptions cannot
 * answer it. An inherited rate is labelled as inherited rather than printed as
 * though somebody chose it.
 */
export function MemberCostRates() {
  const query = useMemberRates();
  const save = useSetMemberRate();
  const clear = useClearMemberRate();

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const payload = query.data?.data ?? null;

  if (query.isLoading) {
    return (
      <SettingsSection
        icon={IconCurrencyDollar}
        title="Cost Rates"
        description="What an hour of each person's time costs the business."
      >
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </SettingsSection>
    );
  }

  // A member hitting this endpoint gets a 403, which is the right answer rather
  // than an error worth showing them: the section simply is not theirs.
  if (!payload) return null;

  const fallback = payload.defaultLaborCostRate;

  return (
    <SettingsSection
      icon={IconCurrencyDollar}
      title="Cost Rates"
      description="What an hour of each person's time costs the business — wages plus overhead, not what you charge. Used to cost the hours recorded on a job."
    >
      {fallback === null && (
        <p className="mb-4 rounded-md border border-border bg-muted/40 p-3 font-body text-xs text-muted-foreground">
          There is no default rate yet, so anyone left blank below has no labour
          cost and their jobs will report an incomplete margin.{" "}
          <Link
            href="/settings/business"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Set a default
          </Link>
          .
        </p>
      )}

      <ul className="divide-y divide-border rounded-md border border-border">
        {payload.members.map((member) => {
          const draft = drafts[member.userId] ?? member.hourlyCostRate ?? "";
          const dirty = draft.trim() !== (member.hourlyCostRate ?? "");
          const busy =
            (save.isPending && save.variables?.userId === member.userId) ||
            (clear.isPending && clear.variables === member.userId);

          return (
            <li
              key={member.userId}
              className="flex flex-wrap items-center gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-medium text-foreground">
                  {member.name || member.email}
                </p>
                <p className="truncate font-body text-xs text-muted-foreground">
                  {member.isOverride
                    ? "Own rate"
                    : fallback
                      ? `Uses the default, ${formatMoney(fallback)} / hr`
                      : "No rate — labour on their jobs is uncosted"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-body text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  value={draft}
                  inputMode="decimal"
                  placeholder={fallback ?? "0.00"}
                  aria-label={`Hourly cost rate for ${member.name || member.email}`}
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [member.userId]: e.target.value }))
                  }
                  className="tnum h-9 w-24 text-right"
                />
                <span className="font-body text-xs text-muted-foreground">
                  / hr
                </span>

                <Button
                  size="sm"
                  disabled={!dirty || busy}
                  className="cursor-pointer bg-brand text-brand-foreground hover:bg-brand/90"
                  onClick={() => {
                    const value = draft.trim();
                    if (value === "") {
                      clear.mutate(member.userId);
                      return;
                    }
                    if (!/^\d{1,8}(\.\d{1,2})?$/.test(value)) return;
                    save.mutate({ userId: member.userId, hourlyCostRate: value });
                  }}
                >
                  {busy ? "Saving…" : "Save"}
                </Button>

                {member.isOverride && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    className="cursor-pointer"
                    onClick={() => {
                      setDrafts((d) => ({ ...d, [member.userId]: "" }));
                      clear.mutate(member.userId);
                    }}
                  >
                    Use default
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 font-body text-xs text-muted-foreground">
        Changing a rate here affects jobs costed from now on. Jobs that already
        have hours keep the rate they were saved with, so a raise does not
        rewrite last quarter&rsquo;s margins.
      </p>
    </SettingsSection>
  );
}
