-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create spaces table for space listings
CREATE TABLE public.spaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  space_type TEXT NOT NULL CHECK (space_type IN ('garage', 'driveway', 'parking_lot', 'warehouse', 'storage_unit')),
  price_per_hour DECIMAL(10,2) NOT NULL,
  price_per_day DECIMAL(10,2),
  address TEXT NOT NULL,
  zip_code TEXT NOT NULL DEFAULT '94110',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  dimensions TEXT,
  available_from TIMESTAMP WITH TIME ZONE,
  available_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  stripe_connect_account_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on spaces
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for spaces
CREATE POLICY "Anyone can view active spaces" 
ON public.spaces 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Owners can manage their spaces" 
ON public.spaces 
FOR ALL
USING (auth.uid() = owner_id);

-- Create space_photos table
CREATE TABLE public.space_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on space_photos
ALTER TABLE public.space_photos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for space_photos
CREATE POLICY "Anyone can view photos of active spaces" 
ON public.space_photos 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = space_photos.space_id 
    AND spaces.is_active = true
  )
);

CREATE POLICY "Space owners can manage photos" 
ON public.space_photos 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = space_photos.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  renter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  stripe_payment_intent_id TEXT,
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bookings
CREATE POLICY "Renters can view their bookings" 
ON public.bookings 
FOR SELECT 
USING (auth.uid() = renter_id);

CREATE POLICY "Space owners can view bookings for their spaces" 
ON public.bookings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = bookings.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Renters can create bookings" 
ON public.bookings 
FOR INSERT 
WITH CHECK (auth.uid() = renter_id);

CREATE POLICY "Space owners can update booking status" 
ON public.bookings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = bookings.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

-- Create negotiations table for AI negotiations
CREATE TABLE public.negotiations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_price DECIMAL(10,2) NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on negotiations
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for negotiations
CREATE POLICY "Users can view negotiations they're involved in" 
ON public.negotiations 
FOR SELECT 
USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create negotiations" 
ON public.negotiations 
FOR INSERT 
WITH CHECK (auth.uid() = from_user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_spaces_updated_at
BEFORE UPDATE ON public.spaces
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Insert seed data for 5-10 space listings in ZIP 94110
INSERT INTO public.spaces (owner_id, title, description, space_type, price_per_hour, price_per_day, address, dimensions) VALUES
-- Note: Using a placeholder UUID for owner_id - this will need to be updated with real user IDs
('00000000-0000-0000-0000-000000000001', 'Spacious Garage in Mission District', 'Clean, secure garage perfect for car storage or small projects. Easy access and well-lit.', 'garage', 8.00, 150.00, '1234 Mission St, San Francisco, CA 94110', '20x12 feet'),
('00000000-0000-0000-0000-000000000002', 'Private Driveway - Valencia Street', 'Convenient driveway parking spot near Valencia Street. Great for daily commuters.', 'driveway', 5.00, 80.00, '567 Valencia St, San Francisco, CA 94110', '10x20 feet'),
('00000000-0000-0000-0000-000000000003', 'Large Warehouse Space', 'Industrial warehouse space available for storage or small business use. Loading dock access.', 'warehouse', 25.00, 400.00, '890 Industrial Blvd, San Francisco, CA 94110', '40x60 feet'),
('00000000-0000-0000-0000-000000000004', 'Covered Garage Near BART', 'Secure covered garage just 2 blocks from 24th St BART station. Perfect for commuters.', 'garage', 10.00, 180.00, '2456 24th St, San Francisco, CA 94110', '18x10 feet'),
('00000000-0000-0000-0000-000000000005', 'Open Parking Lot Space', 'Fenced parking lot with 24/7 access. Good for larger vehicles or temporary storage.', 'parking_lot', 6.00, 100.00, '1357 Folsom St, San Francisco, CA 94110', '12x25 feet'),
('00000000-0000-0000-0000-000000000006', 'Quiet Residential Driveway', 'Peaceful residential area, perfect for overnight parking. Owner on-site for security.', 'driveway', 4.00, 60.00, '789 Guerrero St, San Francisco, CA 94110', '9x18 feet'),
('00000000-0000-0000-0000-000000000007', 'Climate-Controlled Storage Unit', 'Small climate-controlled unit ideal for sensitive items or documents. Indoor access.', 'storage_unit', 12.00, 200.00, '246 Cesar Chavez St, San Francisco, CA 94110', '10x10 feet'),
('00000000-0000-0000-0000-000000000008', 'Wide Garage for Large Vehicles', 'Extra-wide garage that can accommodate SUVs, trucks, or multiple motorcycles.', 'garage', 15.00, 250.00, '135 Potrero Ave, San Francisco, CA 94110', '25x15 feet');