-- Update existing bookings table with new columns for enhanced booking system
-- This migration safely adds columns to existing table without losing data

-- Add missing columns to bookings table
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS original_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS final_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS license_plate TEXT,
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  ADD COLUMN IF NOT EXISTS legal_compliance_checked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS legal_compliance_status TEXT CHECK (legal_compliance_status IN ('allowed', 'restricted', 'prohibited', 'pending')),
  ADD COLUMN IF NOT EXISTS legal_compliance_details JSONB,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;

-- Update bookings status constraint to include new statuses
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE public.bookings 
  ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('pending', 'negotiating', 'accepted', 'confirmed', 'active', 'completed', 'cancelled', 'rejected'));

-- Set default payment_status for existing rows
UPDATE public.bookings 
SET payment_status = 'pending' 
WHERE payment_status IS NULL;

-- Backfill owner_id from spaces table for existing bookings
UPDATE public.bookings b
SET owner_id = s.owner_id
FROM public.spaces s
WHERE b.space_id = s.id AND b.owner_id IS NULL;

-- Add missing columns to negotiations table
ALTER TABLE public.negotiations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

-- Update negotiations status constraint to include 'expired'
ALTER TABLE public.negotiations DROP CONSTRAINT IF EXISTS negotiations_status_check;
ALTER TABLE public.negotiations 
  ADD CONSTRAINT negotiations_status_check 
  CHECK (status IN ('pending', 'accepted', 'rejected', 'countered', 'expired'));

-- Create agreements table for final signed agreements
CREATE TABLE IF NOT EXISTS public.agreements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms TEXT NOT NULL,
  renter_signature TEXT,
  owner_signature TEXT,
  renter_signed_at TIMESTAMP WITH TIME ZONE,
  owner_signed_at TIMESTAMP WITH TIME ZONE,
  fully_executed BOOLEAN DEFAULT false,
  agreement_pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('booking_request', 'negotiation_offer', 'agreement_ready', 'payment_received', 'booking_confirmed', 'booking_cancelled', 'legal_alert')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  email_sent BOOLEAN DEFAULT false,
  sms_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on new tables
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for existing bookings table (enhanced)
DROP POLICY IF EXISTS "Users can view their own bookings as renter" ON public.bookings;
DROP POLICY IF EXISTS "Users can view bookings for their spaces as owner" ON public.bookings;
DROP POLICY IF EXISTS "Renters can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owners can update bookings for their spaces" ON public.bookings;

CREATE POLICY "Users can view their own bookings as renter" 
ON public.bookings FOR SELECT 
USING (auth.uid() = renter_id);

CREATE POLICY "Users can view bookings for their spaces as owner" 
ON public.bookings FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Renters can update their bookings" 
ON public.bookings FOR UPDATE 
USING (auth.uid() = renter_id);

CREATE POLICY "Owners can update bookings for their spaces" 
ON public.bookings FOR UPDATE 
USING (auth.uid() = owner_id);

-- RLS Policies for existing negotiations table (enhanced)
DROP POLICY IF EXISTS "Users can update negotiations sent to them" ON public.negotiations;

CREATE POLICY "Users can update negotiations sent to them" 
ON public.negotiations FOR UPDATE 
USING (auth.uid() = to_user_id);

-- Agreements RLS Policies
CREATE POLICY "Renters can view their agreements" 
ON public.agreements FOR SELECT 
USING (auth.uid() = renter_id);

CREATE POLICY "Owners can view agreements for their spaces" 
ON public.agreements FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "System can create agreements" 
ON public.agreements FOR INSERT 
WITH CHECK (auth.uid() = renter_id OR auth.uid() = owner_id);

CREATE POLICY "Renters can sign their agreements" 
ON public.agreements FOR UPDATE 
USING (auth.uid() = renter_id);

CREATE POLICY "Owners can sign their agreements" 
ON public.agreements FOR UPDATE 
USING (auth.uid() = owner_id);

-- Notifications RLS Policies
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_space_id ON public.bookings(space_id);
CREATE INDEX IF NOT EXISTS idx_bookings_renter_id ON public.bookings(renter_id);
CREATE INDEX IF NOT EXISTS idx_bookings_owner_id ON public.bookings(owner_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON public.bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);

CREATE INDEX IF NOT EXISTS idx_negotiations_booking_id ON public.negotiations(booking_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_from_user_id ON public.negotiations(from_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_to_user_id ON public.negotiations(to_user_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_status ON public.negotiations(status);
CREATE INDEX IF NOT EXISTS idx_negotiations_ai_generated ON public.negotiations(ai_generated);

CREATE INDEX IF NOT EXISTS idx_agreements_booking_id ON public.agreements(booking_id);
CREATE INDEX IF NOT EXISTS idx_agreements_renter_id ON public.agreements(renter_id);
CREATE INDEX IF NOT EXISTS idx_agreements_owner_id ON public.agreements(owner_id);
CREATE INDEX IF NOT EXISTS idx_agreements_fully_executed ON public.agreements(fully_executed);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Trigger for automatic updated_at on bookings (if not exists)
DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at 
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for automatic updated_at on negotiations
DROP TRIGGER IF EXISTS update_negotiations_updated_at ON public.negotiations;
CREATE TRIGGER update_negotiations_updated_at 
  BEFORE UPDATE ON public.negotiations
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for automatic updated_at on agreements
DROP TRIGGER IF EXISTS update_agreements_updated_at ON public.agreements;
CREATE TRIGGER update_agreements_updated_at 
  BEFORE UPDATE ON public.agreements
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function for updating updated_at (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON COLUMN public.bookings.owner_id IS 'Space owner user ID (for quick access)';
COMMENT ON COLUMN public.bookings.original_price IS 'Original listed price per hour';
COMMENT ON COLUMN public.bookings.final_price IS 'Final negotiated price per hour';
COMMENT ON COLUMN public.bookings.license_plate IS 'Renter vehicle license plate number';
COMMENT ON COLUMN public.bookings.payment_status IS 'Stripe payment processing status';
COMMENT ON COLUMN public.bookings.legal_compliance_checked IS 'Whether legal compliance was verified';
COMMENT ON COLUMN public.bookings.legal_compliance_status IS 'Legal compliance result for this location';
COMMENT ON COLUMN public.bookings.legal_compliance_details IS 'Full legal compliance check results';

COMMENT ON COLUMN public.negotiations.ai_generated IS 'Whether this negotiation was created by AI agent';
COMMENT ON COLUMN public.negotiations.responded_at IS 'When the negotiation was responded to';

COMMENT ON TABLE public.agreements IS 'Final rental agreements with digital signatures';
COMMENT ON TABLE public.notifications IS 'User notifications for bookings, negotiations, and agreements';

