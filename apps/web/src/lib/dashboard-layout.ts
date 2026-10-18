import type { WidgetKey } from "@/hooks/use-dashboard-widget-prefs";

/**
 * How the dashboard's cards are laid out, and how a custom order stays tidy.
 *
 * The overdue banner and the KPI row are not here: they are strips across the
 * top of the page, read first every morning, and stay pinned there. Every other
 * card sits in one grid, in an order the user can change (Arrange, on the
 * dashboard toolbar).
 */

/** The cards a user can move, in their default order. */
export const ARRANGEABLE_WIDGETS = [
  "revenue",
  "agenda",
  "weekAhead",
  "invoiceAging",
  "jobsManagement",
  "quoteFunnel",
  "retention",
  "revenueByService",
  "topCustomers",
  "activity",
] as const satisfies readonly WidgetKey[];

export type ArrangeableWidget = (typeof ARRANGEABLE_WIDGETS)[number];

export const DEFAULT_WIDGET_ORDER: readonly ArrangeableWidget[] = ARRANGEABLE_WIDGETS;

export function isArrangeableWidget(key: string): key is ArrangeableWidget {
  return (ARRANGEABLE_WIDGETS as readonly string[]).includes(key);
}

/**
 * Columns a card asks for. Wide cards are the two whose content runs
 * sideways: Revenue's time axis and the activity feed's long lines. Two
 * columns of three means two wide cards can never share a row, whatever the
 * order: the second one wraps.
 */
export const WIDGET_COLUMNS: Record<ArrangeableWidget, 1 | 2> = {
  revenue: 2,
  agenda: 1,
  weekAhead: 1,
  invoiceAging: 1,
  jobsManagement: 1,
  quoteFunnel: 1,
  retention: 1,
  revenueByService: 1,
  topCustomers: 1,
  activity: 2,
};

export interface PlacedWidget {
  key: ArrangeableWidget;
  /** Columns taken in the two-column grid (`md` to `xl`). */
  md: 1 | 2;
  /** Columns taken in the three-column grid (from `xl`). */
  xl: 1 | 2 | 3;
  /** Whether another card shares its row from `xl`. */
  sharesXlRow: boolean;
}

interface Slot {
  span: number;
  row: number;
}

/**
 * Fill rows of `columns` in order. A card that does not fit what is left of a
 * row starts the next one, and the row it leaves is closed by stretching that
 * row's last card over the gap, so no row ever ends in a hole. The order is
 * never changed to fill a gap: what the user arranged is what they get.
 */
function packRows(order: readonly ArrangeableWidget[], columns: number): Slot[] {
  const slots: Slot[] = [];
  let row = 0;
  let used = 0;
  for (const key of order) {
    const span = Math.min(WIDGET_COLUMNS[key], columns);
    if (used > 0 && used + span > columns) {
      slots[slots.length - 1].span += columns - used;
      row += 1;
      used = 0;
    }
    slots.push({ span, row });
    used += span;
    if (used === columns) {
      row += 1;
      used = 0;
    }
  }
  if (used > 0) slots[slots.length - 1].span += columns - used;
  return slots;
}

/** Where each visible card goes in the two-column and three-column grids. */
export function placeWidgets(order: readonly ArrangeableWidget[]): PlacedWidget[] {
  const md = packRows(order, 2);
  const xl = packRows(order, 3);
  return order.map((key, i) => ({
    key,
    md: md[i].span === 2 ? 2 : 1,
    xl: xl[i].span === 3 ? 3 : xl[i].span === 2 ? 2 : 1,
    sharesXlRow: xl.some((slot, j) => j !== i && slot.row === xl[i].row),
  }));
}

// Literal strings, so Tailwind's scanner sees every class. The `xl` class is
// always written, because a `md` span would otherwise carry into a row of three.
const MD_SPAN = { 1: "md:col-span-1", 2: "md:col-span-2" } as const;
const XL_SPAN = {
  1: "xl:col-span-1",
  2: "xl:col-span-2",
  3: "xl:col-span-3",
} as const;

/** The grid classes for a placed card. The grid itself is one column below `md`. */
export function widgetSpanClasses(placed: PlacedWidget): string {
  return `${MD_SPAN[placed.md]} ${XL_SPAN[placed.xl]}`;
}

/** The dashboard grid both the page and the arrange view lay cards out in. */
export const DASHBOARD_GRID = "grid gap-6 md:grid-cols-2 xl:grid-cols-3";

/** Move `active` to where `over` is, the way a drop does: everything between shifts one place. */
export function moveWidget(
  order: readonly ArrangeableWidget[],
  active: ArrangeableWidget,
  over: ArrangeableWidget,
): ArrangeableWidget[] {
  const from = order.indexOf(active);
  const to = order.indexOf(over);
  if (from < 0 || to < 0 || from === to) return [...order];
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, active);
  return next;
}

/**
 * A stored order, made safe to use: unknown keys and repeats dropped, and any
 * card added since the order was saved put at the end rather than lost.
 */
export function sanitizeWidgetOrder(stored: unknown): ArrangeableWidget[] | null {
  if (!Array.isArray(stored)) return null;
  const order: ArrangeableWidget[] = [];
  for (const key of stored) {
    if (typeof key === "string" && isArrangeableWidget(key) && !order.includes(key)) {
      order.push(key);
    }
  }
  for (const key of DEFAULT_WIDGET_ORDER) {
    if (!order.includes(key)) order.push(key);
  }
  return order;
}

export function isDefaultWidgetOrder(order: readonly ArrangeableWidget[]): boolean {
  return (
    order.length === DEFAULT_WIDGET_ORDER.length &&
    order.every((key, i) => key === DEFAULT_WIDGET_ORDER[i])
  );
}
