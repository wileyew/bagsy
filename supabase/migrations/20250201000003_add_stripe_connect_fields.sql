-- Add Stripe Connect account fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account_id 
ON profiles(stripe_connect_account_id);

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_onboarding_completed 
ON profiles(stripe_connect_onboarding_completed);

-- Add comments explaining the fields
COMMENT ON COLUMN profiles.stripe_connect_account_id IS 'Stripe Connect account ID for payment processing and identity verification';
COMMENT ON COLUMN profiles.stripe_connect_onboarding_completed IS 'Whether the user has completed Stripe Connect onboarding';
COMMENT ON COLUMN profiles.stripe_connect_onboarding_completed_at IS 'Timestamp when Stripe Connect onboarding was completed';

-- Update existing payment setup logic to include Connect account
-- This ensures backward compatibility with existing payment_method_setup field
UPDATE profiles 
SET payment_method_setup = TRUE 
WHERE stripe_connect_onboarding_completed = TRUE 
AND payment_method_setup = FALSE;
