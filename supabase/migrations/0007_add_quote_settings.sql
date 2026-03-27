-- Add quote-specific terms & footer settings to tenants table
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "quote_terms_conditions" text;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "quote_footer_message" text;
