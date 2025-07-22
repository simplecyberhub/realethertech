
-- Add isLocked column to coins table
ALTER TABLE coins ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
