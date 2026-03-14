import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { referralSourceEnum } from "./enums";

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessName: text("business_name").notNull(),
    ownerName: text("owner_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    slug: text("slug").notNull(),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    zipCode: text("zip_code"),
    logoUrl: text("logo_url"),
    googleReviewUrl: text("google_review_url"),
    reviewRequestEnabled: boolean("review_request_enabled").default(true),
    timezone: text("timezone").default("America/Chicago"),
    isActive: boolean("is_active").default(true),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    referredByAffiliateId: text("referred_by_affiliate_id"),
    referralSource: referralSourceEnum("referral_source").default("organic"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("idx_tenants_slug").on(table.slug)],
);
