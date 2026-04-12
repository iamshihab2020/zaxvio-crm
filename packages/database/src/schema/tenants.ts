import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { referralSourceEnum } from "./enums";
import { organization } from "./auth";

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").notNull().references(() => organization.id),
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
    defaultTaxRate: text("default_tax_rate").default("0"),
    licenseNumber: text("license_number"),
    invoicePaymentTerms: text("invoice_payment_terms"),
    invoicePaymentInstructions: text("invoice_payment_instructions"),
    invoiceTermsConditions: text("invoice_terms_conditions"),
    invoiceFooterMessage: text("invoice_footer_message"),
    quoteTermsConditions: text("quote_terms_conditions"),
    quoteFooterMessage: text("quote_footer_message"),
    quoteOnlineAcceptanceEnabled: boolean("quote_online_acceptance_enabled").default(true),
    quotePostAcceptanceScheduling: boolean("quote_post_acceptance_scheduling").default(false),
    quoteAutoConvertToJob: boolean("quote_auto_convert_to_job").default(false),
    referralSource: referralSourceEnum("referral_source").default("organic"),
    trialExpiryEmailSentAt: timestamp("trial_expiry_email_sent_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("idx_tenants_slug").on(table.slug)],
);
