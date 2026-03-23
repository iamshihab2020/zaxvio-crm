ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "default_tax_rate" text DEFAULT '0';
