-- Note: RLS is already enabled on storage.objects table by default in Supabase
-- No need to enable it manually

-- Create policy to allow authenticated users to upload files to space-photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Allow authenticated users to upload to space-photos'
  ) THEN
    CREATE POLICY "Allow authenticated users to upload to space-photos" ON storage.objects
    FOR INSERT 
    TO authenticated 
    WITH CHECK (bucket_id = 'space-photos');
  END IF;
END $$;

-- Create policy to allow authenticated users to view files in space-photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Allow authenticated users to view space-photos'
  ) THEN
    CREATE POLICY "Allow authenticated users to view space-photos" ON storage.objects
    FOR SELECT 
    TO authenticated 
    USING (bucket_id = 'space-photos');
  END IF;
END $$;

-- Create policy to allow users to update their own files in space-photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Allow users to update their own space-photos'
  ) THEN
    CREATE POLICY "Allow users to update their own space-photos" ON storage.objects
    FOR UPDATE 
    TO authenticated 
    USING (bucket_id = 'space-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Create policy to allow users to delete their own files in space-photos bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Allow users to delete their own space-photos'
  ) THEN
    CREATE POLICY "Allow users to delete their own space-photos" ON storage.objects
    FOR DELETE 
    TO authenticated 
    USING (bucket_id = 'space-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Allow public access to view files in space-photos bucket (for public URLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname = 'Allow public access to view space-photos'
  ) THEN
    CREATE POLICY "Allow public access to view space-photos" ON storage.objects
    FOR SELECT 
    TO public 
    USING (bucket_id = 'space-photos');
  END IF;
END $$;

-- Note: RLS is already enabled on storage.buckets table by default in Supabase
-- No need to enable it manually

-- Create policy to allow authenticated users to list buckets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'buckets' 
    AND schemaname = 'storage'
    AND policyname = 'Allow authenticated users to list buckets'
  ) THEN
    CREATE POLICY "Allow authenticated users to list buckets" ON storage.buckets
    FOR SELECT 
    TO authenticated 
    USING (true);
  END IF;
END $$;

-- Create policy to allow authenticated users to view space-photos bucket details
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'buckets' 
    AND schemaname = 'storage'
    AND policyname = 'Allow authenticated users to view space-photos bucket'
  ) THEN
    CREATE POLICY "Allow authenticated users to view space-photos bucket" ON storage.buckets
    FOR SELECT 
    TO authenticated 
    USING (id = 'space-photos');
  END IF;
END $$;

-- Allow public access to view space-photos bucket (needed for public file access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'buckets' 
    AND schemaname = 'storage'
    AND policyname = 'Allow public access to view space-photos bucket'
  ) THEN
    CREATE POLICY "Allow public access to view space-photos bucket" ON storage.buckets
    FOR SELECT 
    TO public 
    USING (id = 'space-photos');
  END IF;
END $$;
