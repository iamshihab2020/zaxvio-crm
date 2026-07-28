import {
  pgTable,
  uuid,
  text,
  date,
  time,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { jobs } from "./jobs";

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    eventDate: date("event_date").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    address: text("address"),
    notes: text("notes"),
    color: text("color").default("purple"),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    // Was a bare uuid with no constraint, so deleting a job left the calendar
    // pointing at nothing and the event rendered with an empty job link.
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_calendar_events_tenant_date").on(
      table.tenantId,
      table.eventDate,
    ),
    index("idx_calendar_events_job_id").on(table.jobId),
  ],
);
