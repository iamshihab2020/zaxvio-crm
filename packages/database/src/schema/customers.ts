import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    zipCode: text("zip_code"),
    notes: text("notes"),

    /**
     * When this customer asked to stop receiving non-transactional email.
     *
     * **A nullable timestamp, not a boolean.** "When did they opt out, and how?"
     * is the question support actually gets asked — a customer says "I
     * unsubscribed months ago and you emailed me again", and a boolean cannot
     * tell you whether that is true. The timestamp also survives a re-subscribe
     * as history if we ever add one.
     *
     * Consent belongs to the **recipient**, and the row is already per tenant:
     * one person may be reachable by tenant A and not by tenant B. There is
     * deliberately no tenant-level switch.
     */
    emailOptOutAt: timestamp("email_opt_out_at", { withTimezone: true }),
    /**
     * How it happened — `unsubscribe_link`, `manual`, `complaint`, `import`.
     * Free text rather than an enum because the set will grow (a provider
     * webhook, a support action) and an enum change is a migration for a field
     * nothing branches on.
     */
    emailOptOutSource: text("email_opt_out_source"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_customers_tenant_email").on(table.tenantId, table.email),
    /**
     * Partial, on the opted-out rows only. The question asked of this column is
     * always "who can I no longer reach" — a handful of rows out of thousands —
     * and a full index on a mostly-NULL column would be almost entirely dead
     * weight.
     */
    index("idx_customers_opted_out")
      .on(table.tenantId, table.emailOptOutAt)
      .where(sql`${table.emailOptOutAt} IS NOT NULL`),
  ],
);
