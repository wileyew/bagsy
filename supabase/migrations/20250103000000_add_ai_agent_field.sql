-- Add allow_ai_agent field to spaces table
ALTER TABLE public.spaces 
ADD COLUMN allow_ai_agent BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN public.spaces.allow_ai_agent IS 'Whether the space owner allows AI agent to negotiate on their behalf';
