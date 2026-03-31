-- Add service_frequency enum and frequency column to maintenance_contracts

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'service_frequency') THEN
        CREATE TYPE service_frequency AS ENUM (
            'weekly', 'biweekly', 'monthly', 'quarterly', 'semi_annual', 'annual'
        );
    END IF;
END $$;

ALTER TABLE maintenance_contracts
ADD COLUMN IF NOT EXISTS frequency service_frequency DEFAULT 'annual';

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_tenant_customer
ON maintenance_contracts(tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_maintenance_contracts_end_date
ON maintenance_contracts(end_date);
