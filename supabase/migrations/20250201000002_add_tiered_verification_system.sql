-- Add tiered verification system to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS verification_tier TEXT DEFAULT 'basic' CHECK (verification_tier IN ('basic', 'payment_verified', 'id_verified', 'premium_verified')),
ADD COLUMN IF NOT EXISTS verification_score INTEGER DEFAULT 0 CHECK (verification_score >= 0 AND verification_score <= 100),
ADD COLUMN IF NOT EXISTS address_verification_status TEXT DEFAULT 'pending' CHECK (address_verification_status IN ('pending', 'verified', 'mismatch', 'requires_review')),
ADD COLUMN IF NOT EXISTS address_verification_confidence INTEGER DEFAULT 0 CHECK (address_verification_confidence >= 0 AND address_verification_confidence <= 100),
ADD COLUMN IF NOT EXISTS verified_host_badge BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_badges TEXT DEFAULT '[]', -- JSON array of badges
ADD COLUMN IF NOT EXISTS last_verification_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS fraud_flags INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS high_value_listing_access BOOLEAN DEFAULT FALSE;

-- Add verification tracking to spaces table
ALTER TABLE spaces
ADD COLUMN IF NOT EXISTS verification_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_tier_required TEXT DEFAULT 'basic' CHECK (verification_tier_required IN ('basic', 'payment_verified', 'id_verified', 'premium_verified')),
ADD COLUMN IF NOT EXISTS high_value_listing BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_approved_by UUID REFERENCES auth.users(id);

-- Add verification tracking to bookings table
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS renter_verification_tier TEXT DEFAULT 'basic' CHECK (renter_verification_tier IN ('basic', 'payment_verified', 'id_verified', 'premium_verified')),
ADD COLUMN IF NOT EXISTS verification_checks_passed BOOLEAN DEFAULT FALSE;

-- Create verification_audit_log table for tracking all verification events
CREATE TABLE IF NOT EXISTS public.verification_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('payment_setup', 'address_verification', 'id_verification', 'tier_upgrade', 'fraud_flag', 'verification_failed')),
  previous_tier TEXT,
  new_tier TEXT,
  verification_score INTEGER,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create verification_settings table for configurable thresholds
CREATE TABLE IF NOT EXISTS public.verification_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default verification settings
INSERT INTO public.verification_settings (setting_key, setting_value, description) VALUES
('tier_thresholds', '{
  "basic": {"min_score": 0, "max_score": 39, "description": "New user, no verification"},
  "payment_verified": {"min_score": 40, "max_score": 69, "description": "Payment method verified, address checked"},
  "id_verified": {"min_score": 70, "max_score": 89, "description": "Government ID verified"},
  "premium_verified": {"min_score": 90, "max_score": 100, "description": "Full verification with premium features"}
}', 'Verification tier score thresholds'),
('high_value_threshold', '100', 'Daily price threshold for high-value listing verification'),
('address_match_thresholds', '{
  "verified": {"min_confidence": 80, "auto_approve": true},
  "review_required": {"min_confidence": 60, "max_confidence": 79, "auto_approve": false},
  "mismatch": {"max_confidence": 59, "auto_approve": false, "require_id": true}
}', 'Address matching confidence thresholds'),
('fraud_detection', '{
  "max_flags": 3,
  "auto_downgrade": true,
  "require_manual_review": true
}', 'Fraud detection and response settings')
ON CONFLICT (setting_key) DO NOTHING;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_verification_tier ON profiles(verification_tier);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_score ON profiles(verification_score);
CREATE INDEX IF NOT EXISTS idx_profiles_verified_host_badge ON profiles(verified_host_badge);
CREATE INDEX IF NOT EXISTS idx_profiles_address_verification_status ON profiles(address_verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_high_value_listing_access ON profiles(high_value_listing_access);

CREATE INDEX IF NOT EXISTS idx_spaces_verification_required ON spaces(verification_required);
CREATE INDEX IF NOT EXISTS idx_spaces_high_value_listing ON spaces(high_value_listing);
CREATE INDEX IF NOT EXISTS idx_spaces_verification_tier_required ON spaces(verification_tier_required);

CREATE INDEX IF NOT EXISTS idx_verification_audit_log_user_id ON verification_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_audit_log_event_type ON verification_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_verification_audit_log_created_at ON verification_audit_log(created_at DESC);

-- Enable RLS on new tables
ALTER TABLE public.verification_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for verification_audit_log
CREATE POLICY "Users can view their own verification audit log" 
ON public.verification_audit_log 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can create verification audit log entries" 
ON public.verification_audit_log 
FOR INSERT 
WITH CHECK (true);

-- RLS Policies for verification_settings (admin only)
CREATE POLICY "Authenticated users can view verification settings" 
ON public.verification_settings 
FOR SELECT 
TO authenticated
USING (true);

-- Create function to calculate verification score
CREATE OR REPLACE FUNCTION public.calculate_verification_score(
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  profile_record RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO profile_record 
  FROM profiles 
  WHERE user_id = p_user_id;
  
  -- Base score for having a profile
  IF profile_record.id IS NOT NULL THEN
    score := score + 10;
  END IF;
  
  -- Payment method setup (30 points)
  IF profile_record.payment_method_setup = true THEN
    score := score + 30;
  END IF;
  
  -- Address verification (20 points based on confidence)
  IF profile_record.address_verification_confidence IS NOT NULL THEN
    score := score + (profile_record.address_verification_confidence * 0.2)::INTEGER;
  END IF;
  
  -- Driver's license verification (30 points)
  IF profile_record.driver_license_verified = true THEN
    score := score + 30;
  END IF;
  
  -- Verified host badge (10 points)
  IF profile_record.verified_host_badge = true THEN
    score := score + 10;
  END IF;
  
  -- Deduct points for fraud flags (5 points per flag)
  IF profile_record.fraud_flags > 0 THEN
    score := score - (profile_record.fraud_flags * 5);
  END IF;
  
  -- Ensure score is between 0 and 100
  score := GREATEST(0, LEAST(100, score));
  
  RETURN score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to determine verification tier
CREATE OR REPLACE FUNCTION public.determine_verification_tier(
  p_score INTEGER
) RETURNS TEXT AS $$
BEGIN
  IF p_score >= 90 THEN
    RETURN 'premium_verified';
  ELSIF p_score >= 70 THEN
    RETURN 'id_verified';
  ELSIF p_score >= 40 THEN
    RETURN 'payment_verified';
  ELSE
    RETURN 'basic';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to update verification tier and score
CREATE OR REPLACE FUNCTION public.update_verification_tier(
  p_user_id UUID
) RETURNS TEXT AS $$
DECLARE
  new_score INTEGER;
  new_tier TEXT;
  current_tier TEXT;
  profile_record RECORD;
BEGIN
  -- Calculate new score
  new_score := calculate_verification_score(p_user_id);
  
  -- Determine new tier
  new_tier := determine_verification_tier(new_score);
  
  -- Get current tier
  SELECT verification_tier INTO current_tier
  FROM profiles
  WHERE user_id = p_user_id;
  
  -- Update profile if tier changed
  IF current_tier != new_tier THEN
    UPDATE profiles
    SET 
      verification_tier = new_tier,
      verification_score = new_score,
      last_verification_check = now()
    WHERE user_id = p_user_id;
    
    -- Log tier change
    INSERT INTO verification_audit_log (
      user_id,
      event_type,
      previous_tier,
      new_tier,
      verification_score
    ) VALUES (
      p_user_id,
      'tier_upgrade',
      current_tier,
      new_tier,
      new_score
    );
    
    -- Set high-value listing access based on tier
    IF new_tier IN ('id_verified', 'premium_verified') THEN
      UPDATE profiles
      SET high_value_listing_access = true
      WHERE user_id = p_user_id;
    END IF;
  ELSE
    -- Just update score if tier hasn't changed
    UPDATE profiles
    SET 
      verification_score = new_score,
      last_verification_check = now()
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN new_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-update verification tier when profile changes
CREATE OR REPLACE FUNCTION public.trigger_update_verification_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Update verification tier for the user
  PERFORM update_verification_tier(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_verification_tier_trigger
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_verification_tier();

-- Add comments for documentation
COMMENT ON COLUMN profiles.verification_tier IS 'User verification tier: basic, payment_verified, id_verified, premium_verified';
COMMENT ON COLUMN profiles.verification_score IS 'Calculated verification score (0-100)';
COMMENT ON COLUMN profiles.address_verification_status IS 'Status of address verification against billing address';
COMMENT ON COLUMN profiles.address_verification_confidence IS 'Confidence score (0-100) of address verification';
COMMENT ON COLUMN profiles.verified_host_badge IS 'Whether user has earned verified host badge';
COMMENT ON COLUMN profiles.verification_badges IS 'JSON array of verification badges earned';
COMMENT ON COLUMN profiles.fraud_flags IS 'Number of fraud flags raised against user';
COMMENT ON COLUMN profiles.high_value_listing_access IS 'Whether user can create high-value listings';

COMMENT ON COLUMN spaces.verification_required IS 'Whether this listing requires additional verification';
COMMENT ON COLUMN spaces.verification_tier_required IS 'Minimum verification tier required to book this space';
COMMENT ON COLUMN spaces.high_value_listing IS 'Whether this is a high-value listing requiring special verification';
COMMENT ON COLUMN spaces.verification_approved_at IS 'When this listing was approved for verification requirements';

COMMENT ON TABLE public.verification_audit_log IS 'Audit trail of all verification events and tier changes';
COMMENT ON TABLE public.verification_settings IS 'Configurable settings for verification system';
