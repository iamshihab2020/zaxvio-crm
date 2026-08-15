import type {
  jobExpenses,
  jobTimeEntries,
  tenantMemberRates,
} from "@hvac-saas/database";

export type JobExpense = typeof jobExpenses.$inferSelect;
export type JobExpenseInsert = typeof jobExpenses.$inferInsert;
export type JobExpenseUpdate = Partial<JobExpenseInsert>;

export type TenantMemberRate = typeof tenantMemberRates.$inferSelect;
export type TenantMemberRateInsert = typeof tenantMemberRates.$inferInsert;

/**
 * A time entry as it crosses the wire.
 *
 * Deliberately **not** `typeof jobTimeEntries.$inferSelect`. Drizzle types every
 * timestamp as a `Date`; the boundary is JSON, so they arrive as strings — the
 * same find that produced `WorkflowListItem` and removed a cast from every
 * consumer of the automations list.
 *
 * `hourlyCostRate` and `cost` are withheld from members and present only for
 * owners and admins: a per-person hourly rate is payroll data, which is why
 * `tenant_member_rates` is already gated on `requireOrgRole(["owner","admin"])`.
 * `undefined` here means "not yours to see", which is distinct from `null`
 * meaning "nobody has set a rate".
 */
export interface JobTimeEntryView {
  id: string;
  jobId: string;
  userId: string;
  /** Display name of the person who did the work; null if the user is gone. */
  userName: string | null;
  startedAt: string;
  /** Null while the clock is running. */
  endedAt: string | null;
  /** `ended_at - started_at` in hours, to two decimals. Null while running. */
  hours: string | null;
  hourlyCostRate?: string | null;
  /** `hours * hourlyCostRate`. Null when the rate is unknown. */
  cost?: string | null;
  note: string | null;
  autoStopped: boolean;
  createdAt: string;
}

/** The running timer for the current user, if there is one. */
export interface RunningTimer {
  id: string;
  jobId: string;
  jobNumber: string;
  jobTitle: string;
  startedAt: string;
}

/**
 * How complete a cost figure is.
 *
 * This is the type that keeps the feature honest. Every cost input can be
 * unknown, and an unknown cost makes a job's cost *incomplete* — not lower.
 * Reporting a margin without saying how much of the cost side was actually
 * filled in is how a costing tool ends up confidently wrong, so the coverage
 * always travels with the money.
 */
export interface CostCoverage {
  /** Line items on the job that have a `unitCost` set. */
  costedLineItems: number;
  /** Line items in total. `costedLineItems < lineItems` ⇒ cost understated. */
  lineItems: number;
  /**
   * True when the job has at least one closed time entry *and* every one of
   * them carries a rate. One entry logged by somebody with no rate set makes
   * labour understated in exactly the way an uncosted line item does.
   */
  laborCosted: boolean;
  /** Closed time entries on the job. */
  timeEntries: number;
  /** Of those, how many carry an `hourlyCostRate`. */
  costedTimeEntries: number;
  /**
   * Entries the sweep closed because the timer ran past the ceiling. They still
   * count toward hours, but somebody should look at them — so the figure is
   * provisional while any exist.
   */
  autoStoppedTimeEntries: number;
  /** Every cost input is filled in, so the margin can be stated plainly. */
  complete: boolean;
  /** Human-readable reasons the figure is provisional. Empty when complete. */
  gaps: string[];
}

/** Where a job's revenue figure came from. */
export type RevenueBasis =
  /** Sum of the job's non-draft, non-void, non-archived invoices. */
  | "invoiced"
  /** No invoice exists yet; the job's own line-item total stands in. */
  | "estimated";

/**
 * The derived cost/margin rollup for one job. Never stored — recomputed on
 * read, the same "derive, don't assign" rule the invoice money model follows.
 * All money values are strings, matching how `numeric` columns cross the wire
 * everywhere else in this codebase.
 */
export interface JobCostSummary {
  jobId: string;

  /** Sum of `job_line_items.cost_total`, ignoring uncosted lines. */
  lineItemCost: string;
  /** Sum of `job_expenses.amount`. */
  expenseCost: string;
  /**
   * Sum of `hours * hourlyCostRate` across the job's **closed** time entries,
   * each at its own snapshotted rate — so a job worked by two people at
   * different rates costs what it actually cost. Entries with no rate
   * contribute nothing and are reported through `coverage` instead.
   */
  laborCost: string;
  /** The three above, added. */
  totalCost: string;

  /** Sum of the job's closed entry durations. Null when it has none. */
  actualHours: string | null;
  /**
   * How many closed entries produced `actualHours`. There is deliberately no
   * single `laborCostRate` any more: rates live per entry, and one job can
   * legitimately carry several.
   */
  timeEntryCount: number;

  revenue: string;
  revenueBasis: RevenueBasis;

  /** `revenue - totalCost`. Negative means the job lost money. */
  margin: string;
  /**
   * `margin / revenue` as a 0–1 fraction, or null when revenue is 0 — a
   * percentage of nothing is not 0%, it is undefined, and rendering it as 0%
   * would put a job that cost $300 and billed nothing beside a break-even one.
   */
  marginPct: number | null;

  coverage: CostCoverage;
}

/** One row of the profitability report, whatever it is grouped by. */
export interface ProfitabilityRow {
  /** Group identity: a job id, customer id, user id, or service_type value. */
  key: string;
  label: string;
  jobCount: number;
  revenue: string;
  cost: string;
  margin: string;
  marginPct: number | null;
  /**
   * Jobs in this group whose cost was incomplete. They are **excluded** from
   * the figures above rather than averaged in, because a job missing its cost
   * inputs would drag the group's margin up toward 100% and make an unprofitable
   * segment look healthy. Surfaced so the number can be read with the right
   * amount of trust.
   */
  excludedJobCount: number;
}

export interface ProfitabilitySection {
  /** Totals across every fully-costed completed job in the window. */
  totals: {
    jobCount: number;
    revenue: string;
    cost: string;
    margin: string;
    marginPct: number | null;
    excludedJobCount: number;
    /** Cost inputs are configured at all — false means "set up costing first". */
    costingConfigured: boolean;
    /**
     * The window held more completed jobs than one rollup will process, so
     * these figures cover only the most recently completed of them. Surfaced
     * rather than swallowed: a total that quietly stopped counting reads
     * exactly like a real one.
     */
    truncated: boolean;
  };
  /** The thinnest-margin jobs in the window — the ones worth looking at. */
  byJob: ProfitabilityRow[];
  byServiceType: ProfitabilityRow[];
  /** Highest-revenue customers in the window. */
  byCustomer: ProfitabilityRow[];
  byAssignee: ProfitabilityRow[];
}
