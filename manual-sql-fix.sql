-- Manual SQL fix for storage bucket (run this FIRST in Supabase SQL Editor)
-- This script will create the bucket and set it to public to avoid RLS issues

-- IMPORTANT: Run this script BEFORE using the app to avoid RLS errors

-- Option 1: Create bucket and make it public (recommended)
INSERT INTO storage.buckets (id, name, "public", file_size_limit)
VALUES (
  'space-photos',
  'space-photos', 
  true,
  10485760 -- 10MB limit
);

-- Option 2: If bucket already exists, just make it public
UPDATE storage.buckets 
SET [public] = true,
WHERE id = 'space-photos';

-- Option 2: Set up RLS policies (more secure but requires the policies)
-- Uncomment the lines below if you want to use RLS policies instead

/*
-- Enable RLS on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to upload files to space-photos bucket
CREATE POLICY "Allow authenticated users to upload to space-photos" ON storage.objects
FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'space-photos');

-- Create policy to allow authenticated users to view files in space-photos bucket
CREATE POLICY "Allow authenticated users to view space-photos" ON storage.objects
FOR SELECT 
TO authenticated 
USING (bucket_id = 'space-photos');

-- Create policy to allow users to update their own files in space-photos bucket
CREATE POLICY "Allow users to update their own space-photos" ON storage.objects
FOR UPDATE 
TO authenticated 
USING (bucket_id = 'space-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create policy to allow users to delete their own files in space-photos bucket
CREATE POLICY "Allow users to delete their own space-photos" ON storage.objects
FOR DELETE 
TO authenticated 
USING (bucket_id = 'space-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public access to view files in space-photos bucket (for public URLs)
CREATE POLICY "Allow public access to view space-photos" ON storage.objects
FOR SELECT 
TO public 
USING (bucket_id = 'space-photos');

-- Enable RLS on storage.buckets table
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to list buckets
CREATE POLICY "Allow authenticated users to list buckets" ON storage.buckets
FOR SELECT 
TO authenticated 
USING (true);

-- Create policy to allow authenticated users to view space-photos bucket details
CREATE POLICY "Allow authenticated users to view space-photos bucket" ON storage.buckets
FOR SELECT 
TO authenticated 
USING (id = 'space-photos');

-- Allow public access to view space-photos bucket (needed for public file access)
CREATE POLICY "Allow public access to view space-photos bucket" ON storage.buckets
FOR SELECT 
TO public 
USING (id = 'space-photos');

-- Make the bucket public for easier access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'space-photos';
*/
