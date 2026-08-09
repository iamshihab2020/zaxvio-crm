/**
 * Expense categories, mirroring `expenseCategoryEnum` in the database schema.
 *
 * These are the costs a job accrues that no line item accounts for: the parts
 * run, the subcontractor's invoice, the permit fee. They are named for what a
 * contractor calls them, not for how they are stored.
 */
export const EXPENSE_CATEGORIES = [
  "material",
  "subcontractor",
  "permit",
  "fuel",
  "equipment_rental",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: "Materials",
  subcontractor: "Subcontractor",
  permit: "Permits & fees",
  fuel: "Fuel & travel",
  equipment_rental: "Equipment rental",
  other: "Other",
};

/**
 * The three cost inputs, in the order they stack.
 *
 * Order is deliberate: parts and materials first because they are the largest
 * and the most often costed, then labour, then the odds and ends. Reading the
 * bar left to right is reading the job from the van to the invoice.
 */
export const COST_SEGMENTS = [
  { key: "lineItemCost", label: "Parts & labour billed", tone: "bg-brand" },
  { key: "laborCost", label: "Time on site", tone: "bg-brand/60" },
  { key: "expenseCost", label: "Expenses", tone: "bg-brand/35" },
] as const;
