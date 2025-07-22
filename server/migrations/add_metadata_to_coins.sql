-- Add metadata column to coins table
ALTER TABLE coins ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;