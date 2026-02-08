-- Add is_showcase column to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_showcase boolean DEFAULT false NOT NULL;
