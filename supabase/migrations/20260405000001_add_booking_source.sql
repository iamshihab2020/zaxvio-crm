-- Add source tracking to bookings
-- Values: 'portal' (direct link), 'embed' (iframe), 'widget' (script), 'manual' (contractor created)
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'portal';
