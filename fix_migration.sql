-- Fix migration conflicts by dropping existing policies that might conflict
-- This is a temporary script to resolve migration issues

-- Drop existing agreements policies if they exist
DROP POLICY IF EXISTS "Renters can view their agreements" ON public.agreements;
DROP POLICY IF EXISTS "Owners can view agreements for their spaces" ON public.agreements;
DROP POLICY IF EXISTS "System can create agreements" ON public.agreements;
DROP POLICY IF EXISTS "Renters can sign their agreements" ON public.agreements;
DROP POLICY IF EXISTS "Owners can sign their agreements" ON public.agreements;

-- Drop existing notifications policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Drop existing bookings policies if they exist
DROP POLICY IF EXISTS "Users can view their own bookings as renter" ON public.bookings;
DROP POLICY IF EXISTS "Users can view bookings for their spaces as owner" ON public.bookings;
DROP POLICY IF EXISTS "Renters can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owners can update bookings for their spaces" ON public.bookings;

-- Drop existing negotiations policies if they exist
DROP POLICY IF EXISTS "Users can update negotiations sent to them" ON public.negotiations;

-- Now the migrations should run cleanly
SELECT 'Migration policies cleaned up. You can now run the migrations.' as status;
