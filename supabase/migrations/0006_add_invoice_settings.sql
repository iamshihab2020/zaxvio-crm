-- Add invoice-related settings columns to tenants table
-- All nullable text fields — if empty, the corresponding section is hidden on the PDF

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "license_number" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "invoice_payment_terms" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "invoice_payment_instructions" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "invoice_terms_conditions" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "invoice_footer_message" text;
