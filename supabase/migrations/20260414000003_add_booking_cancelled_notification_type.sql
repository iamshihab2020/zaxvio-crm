-- Add booking_cancelled to notification_type enum (DF-BK-22)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'booking_cancelled'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notification_type')
    ) THEN
        ALTER TYPE "notification_type" ADD VALUE 'booking_cancelled';
    END IF;
END $$;
