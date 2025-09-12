-- Manual SQL fix for RLS policies (run this in Supabase SQL Editor if needed)
-- This script will set up proper RLS policies for storage

-- First, let's check if the bucket exists and is public
-- If you want to use RLS policies, run this script in Supabase SQL Editor

-- Option 1: Make bucket public (simplest solution)
UPDATE storage.buckets 
SET public = true 
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
