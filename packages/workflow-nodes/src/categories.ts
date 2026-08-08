import type { NodeCategory } from "./node-definition.js";

/**
 * Palette grouping and node chrome colour.
 *
 * Colour resolves subcategory → category → the node's own override, in that
 * order. Per-node colours produce a rainbow; per-category alone is too coarse
 * to tell an email from an internal notification at a glance.
 */

export interface CategoryMeta {
  id: NodeCategory;
  label: string;
  description: string;
  color: string;
  order: number;
}

export const CATEGORIES: Record<NodeCategory, CategoryMeta> = {
  trigger: {
    id: "trigger",
    label: "Triggers",
    description: "What starts this automation",
    color: "#10B981",
    order: 1,
  },
  communication: {
    id: "communication",
    label: "Communication",
    description: "Reach a customer or your team",
    color: "#4F46E5",
    order: 2,
  },
  crm: {
    id: "crm",
    label: "Actions",
    description: "Create and update records",
    color: "#F59E0B",
    order: 3,
  },
  logic: {
    id: "logic",
    label: "Logic & timing",
    description: "Branch, wait, stop",
    color: "#8B5CF6",
    order: 4,
  },
  data: {
    id: "data",
    label: "Data",
    description: "Shape values for later steps",
    color: "#EC4899",
    order: 5,
  },
  integration: {
    id: "integration",
    label: "Integrations",
    description: "Talk to other systems",
    color: "#06B6D4",
    order: 6,
  },
};

export interface SubcategoryMeta {
  id: string;
  label: string;
  category: NodeCategory;
  color?: string;
  order: number;
}

export const SUBCATEGORIES: SubcategoryMeta[] = [
  // triggers
  { id: "trigger.job", label: "Jobs", category: "trigger", order: 1 },
  { id: "trigger.booking", label: "Bookings", category: "trigger", order: 2 },
  { id: "trigger.quote", label: "Quotes", category: "trigger", order: 3 },
  { id: "trigger.invoice", label: "Invoices", category: "trigger", order: 4 },
  { id: "trigger.customer", label: "Customers", category: "trigger", order: 5 },
  { id: "trigger.asset", label: "Assets & agreements", category: "trigger", order: 6 },
  { id: "trigger.system", label: "Schedule & webhooks", category: "trigger", order: 7 },
  // actions
  { id: "crm.job", label: "Jobs", category: "crm", order: 1 },
  { id: "crm.customer", label: "Customers", category: "crm", order: 2 },
  { id: "crm.quote", label: "Quotes", category: "crm", order: 3 },
  { id: "crm.invoice", label: "Invoices", category: "crm", order: 4 },
  { id: "crm.booking", label: "Bookings", category: "crm", order: 5 },
  { id: "crm.asset", label: "Assets & agreements", category: "crm", order: 6 },
  // communication
  //
  // Split by *who reads it*, not by transport. "Send an email to the customer"
  // and "tell my team" are different decisions with different consent rules —
  // one goes through `canEmailCustomer()` and one does not — and grouping them
  // under a single "Messaging" heading would put the two a click apart in the
  // palette with nothing to distinguish them.
  { id: "communication.email", label: "To the customer", category: "communication", order: 1 },
  { id: "communication.internal", label: "To your team", category: "communication", order: 2 },
  // logic
  { id: "logic.branch", label: "Branching", category: "logic", order: 1 },
  { id: "logic.timing", label: "Timing", category: "logic", order: 2 },
  { id: "logic.control", label: "Flow control", category: "logic", order: 3 },
];

const SUBCATEGORY_BY_ID = new Map(SUBCATEGORIES.map((s) => [s.id, s]));

export function getSubcategory(id: string | undefined): SubcategoryMeta | undefined {
  return id ? SUBCATEGORY_BY_ID.get(id) : undefined;
}

/** Subcategory → category → the node's own override. */
export function resolveNodeColor(input: {
  category: NodeCategory;
  subcategory?: string;
  color?: string;
}): string {
  const sub = getSubcategory(input.subcategory);
  return sub?.color ?? CATEGORIES[input.category]?.color ?? input.color ?? "#64748B";
}
