-- Add driver's license verification fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS driver_license_url TEXT,
ADD COLUMN IF NOT EXISTS driver_license_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS driver_license_uploaded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS driver_license_extracted_address TEXT,
ADD COLUMN IF NOT EXISTS driver_license_extracted_name TEXT,
ADD COLUMN IF NOT EXISTS driver_license_expiration_date TEXT,
ADD COLUMN IF NOT EXISTS driver_license_verification_confidence INTEGER,
ADD COLUMN IF NOT EXISTS driver_license_verification_notes TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_driver_license_verified 
ON profiles(driver_license_verified);

-- Add comments explaining the fields
COMMENT ON COLUMN profiles.driver_license_url IS 'URL to the uploaded driver license photo stored in Supabase Storage';
COMMENT ON COLUMN profiles.driver_license_verified IS 'Whether the driver license has been verified by admin/AI';
COMMENT ON COLUMN profiles.driver_license_uploaded_at IS 'Timestamp when the driver license was uploaded';
COMMENT ON COLUMN profiles.driver_license_extracted_address IS 'Address extracted from the license via OCR';
COMMENT ON COLUMN profiles.driver_license_extracted_name IS 'Name extracted from the license via OCR';
COMMENT ON COLUMN profiles.driver_license_expiration_date IS 'Expiration date extracted from the license';
COMMENT ON COLUMN profiles.driver_license_verification_confidence IS 'Confidence score (0-100) of address verification';
COMMENT ON COLUMN profiles.driver_license_verification_notes IS 'Notes from automatic or manual verification';

-- Create storage bucket for driver licenses if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-licenses', 'driver-licenses', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for driver licenses bucket
-- Allow authenticated users to upload their own driver license
CREATE POLICY "Users can upload their own driver license"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-licenses' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their own driver license
CREATE POLICY "Users can read their own driver license"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-licenses' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own driver license
CREATE POLICY "Users can update their own driver license"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-licenses' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own driver license
CREATE POLICY "Users can delete their own driver license"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'driver-licenses' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

