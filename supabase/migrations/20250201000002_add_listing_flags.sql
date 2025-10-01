-- Create listing flags table for moderation
CREATE TABLE IF NOT EXISTS listing_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  flagger_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'fake_listing',
    'fake_photos',
    'wrong_address',
    'unsafe_space',
    'price_scam',
    'unverified_owner',
    'spam',
    'other'
  )),
  flag_reason TEXT NOT NULL,
  auto_flagged BOOLEAN DEFAULT FALSE,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_listing_flags_space_id ON listing_flags(space_id);
CREATE INDEX IF NOT EXISTS idx_listing_flags_status ON listing_flags(status);
CREATE INDEX IF NOT EXISTS idx_listing_flags_created_at ON listing_flags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_flags_auto_flagged ON listing_flags(auto_flagged);

-- Add flag counter to spaces table
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMP WITH TIME ZONE;

-- Create index for flagged spaces
CREATE INDEX IF NOT EXISTS idx_spaces_is_flagged ON spaces(is_flagged);

-- Function to update flag count
CREATE OR REPLACE FUNCTION update_space_flag_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update flag count for the space
  UPDATE spaces
  SET 
    flag_count = (
      SELECT COUNT(*) 
      FROM listing_flags 
      WHERE space_id = NEW.space_id 
      AND status != 'dismissed'
    ),
    is_flagged = TRUE,
    flagged_at = CASE 
      WHEN (SELECT COUNT(*) FROM listing_flags WHERE space_id = NEW.space_id AND status != 'dismissed') > 0 
      THEN NOW() 
      ELSE NULL 
    END
  WHERE id = NEW.space_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update flag count
CREATE TRIGGER trigger_update_flag_count
AFTER INSERT OR UPDATE ON listing_flags
FOR EACH ROW
EXECUTE FUNCTION update_space_flag_count();

-- RLS Policies for listing_flags
ALTER TABLE listing_flags ENABLE ROW LEVEL SECURITY;

-- Users can view flags on their own listings
CREATE POLICY "Users can view flags on their own listings"
ON listing_flags FOR SELECT
TO authenticated
USING (
  space_id IN (
    SELECT id FROM spaces WHERE owner_id = auth.uid()
  )
);

-- Users can flag any listing (but not their own)
CREATE POLICY "Users can flag listings"
ON listing_flags FOR INSERT
TO authenticated
WITH CHECK (
  space_id NOT IN (
    SELECT id FROM spaces WHERE owner_id = auth.uid()
  )
);

-- Only system can create auto-flags (service role)
CREATE POLICY "System can create auto-flags"
ON listing_flags FOR INSERT
TO service_role
WITH CHECK (auto_flagged = TRUE);

-- Users can update their own flags (within 24 hours)
CREATE POLICY "Users can update their own flags"
ON listing_flags FOR UPDATE
TO authenticated
USING (
  flagger_user_id = auth.uid() 
  AND created_at > NOW() - INTERVAL '24 hours'
  AND status = 'pending'
);

-- Admins can view all flags (you'll need to create an admin role)
-- For now, we'll use a simple check based on user email
CREATE POLICY "Admins can view all flags"
ON listing_flags FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email LIKE '%@bagsy.space'
  )
);

-- Admins can update any flag
CREATE POLICY "Admins can update flags"
ON listing_flags FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND email LIKE '%@bagsy.space'
  )
);

-- Add comments
COMMENT ON TABLE listing_flags IS 'Stores user reports and automatic flags for suspicious listings';
COMMENT ON COLUMN listing_flags.flag_type IS 'Type of flag: fake_listing, fake_photos, wrong_address, etc.';
COMMENT ON COLUMN listing_flags.auto_flagged IS 'TRUE if flagged automatically by system, FALSE if user-reported';
COMMENT ON COLUMN listing_flags.confidence_score IS 'For auto-flags: confidence level 0-100';
COMMENT ON COLUMN listing_flags.status IS 'Flag status: pending, reviewing, resolved, dismissed';
COMMENT ON COLUMN spaces.flag_count IS 'Number of active (non-dismissed) flags on this listing';
COMMENT ON COLUMN spaces.is_flagged IS 'TRUE if listing has any active flags';

