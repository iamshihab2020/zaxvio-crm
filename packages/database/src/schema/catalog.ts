import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { itemTypeEnum } from "./enums";
import { tenants } from "./tenants";

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    itemType: itemTypeEnum("item_type").notNull(),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
    /**
     * What this item costs *you* — the wholesale price of a part, or your
     * loaded hourly cost for a labour item.
     *
     * Nullable on purpose, and NULL means **unknown, not zero**. Defaulting to
     * 0 would report 100% margin on every item nobody has costed yet, which is
     * precisely the false confidence this whole feature exists to prevent.
     * Everything downstream treats NULL as "missing input" and degrades the
     * margin to provisional rather than inventing a number.
     */
    unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
    unit: text("unit").default("each"),
    category: text("category"),
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_catalog_items_tenant_active").on(
      table.tenantId,
      table.isActive,
    ),
  ],
);
