-- Add timezone field to spaces table for better datetime handling
-- This script can be run on the production database

ALTER TABLE spaces ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

-- Add comment to explain the timezone field
COMMENT ON COLUMN spaces.timezone IS 'Timezone for the available_from and available_until fields';

-- Update existing records to have a default timezone
UPDATE spaces SET timezone = 'America/Los_Angeles' WHERE timezone IS NULL;
