import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { subscriptionStatusEnum } from "./enums";
import { tenants } from "./tenants";

export const tenantSubscriptions = pgTable(
  "tenant_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    lemonSqueezySubscriptionId: text("lemon_squeezy_subscription_id"),
    lemonSqueezyCustomerId: text("lemon_squeezy_customer_id"),
    status: subscriptionStatusEnum("status").notNull().default("trialing"),
    planName: text("plan_name").default("starter"),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    affiliateCommissionRate: numeric("affiliate_commission_rate", {
      precision: 5,
      scale: 4,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tenant_subscriptions_tenant").on(table.tenantId),
  ],
);
