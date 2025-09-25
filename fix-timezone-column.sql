-- Fix timezone column issue in spaces table
-- Run these commands in your Supabase SQL editor

-- First, check if the timezone column exists
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'spaces' AND column_name = 'timezone';

-- If the column doesn't exist, add it
ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles';

-- Add comment to explain the timezone field
COMMENT ON COLUMN public.spaces.timezone IS 'Timezone for the available_from and available_until fields';

-- Also add the AI enhancement fields if they don't exist
ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS allow_ai_agent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS smart_scheduling_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS ai_marketing_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS predictive_analytics_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS ai_support_enabled BOOLEAN DEFAULT false;

ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS space_types TEXT DEFAULT '[]';

-- Add comments for the AI enhancement fields
COMMENT ON COLUMN public.spaces.allow_ai_agent IS 'Whether the space owner allows AI agent to negotiate on their behalf';
COMMENT ON COLUMN public.spaces.smart_scheduling_enabled IS 'Whether AI should optimize availability and scheduling for this space';
COMMENT ON COLUMN public.spaces.ai_marketing_enabled IS 'Whether AI should generate marketing content for this space';
COMMENT ON COLUMN public.spaces.predictive_analytics_enabled IS 'Whether AI should provide predictive analytics for this space';
COMMENT ON COLUMN public.spaces.ai_support_enabled IS 'Whether AI should handle customer support for this space';
COMMENT ON COLUMN public.spaces.space_types IS 'Array of space types this space can accommodate';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'spaces' 
ORDER BY ordinal_position;
