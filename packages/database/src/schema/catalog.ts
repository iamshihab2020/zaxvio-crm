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
