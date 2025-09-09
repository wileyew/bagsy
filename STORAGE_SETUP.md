# Supabase Storage Setup Guide

This guide will help you set up Supabase Storage for handling space photos in your PocketSpot application.

## Step 1: Create Storage Bucket

### 1.1 Access Supabase Dashboard
- Go to [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project: `uwbkdjmmwmpnxjeuzogo`

### 1.2 Create Storage Bucket
- Navigate to "Storage" in the left sidebar
- Click "Create a new bucket"
- Enter bucket name: `space-photos`
- Set bucket as **Public** (so photos can be viewed by users)
- Click "Create bucket"

### 1.3 Configure Storage Policies
- Click on the `space-photos` bucket
- Go to "Policies" tab
- Click "New Policy" to add policies

#### Policy 1: Allow authenticated users to upload photos
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT WITH CHECK (
  -- restrict bucket
  bucket_id = 'space-photos'
  -- allow access to image files
  AND storage."extension"(name) IN ('jpg', 'jpeg', 'png', 'webp')
  -- to authenticated users
  AND auth.role() = 'authenticated'
);
```

#### Policy 2: Allow public read access to photos
```sql
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT USING (
  -- restrict bucket
  bucket_id = 'space-photos'
  -- allow access to image files
  AND storage."extension"(name) IN ('jpg', 'jpeg', 'png', 'webp')
  -- to all users (public)
  AND auth.role() IN ('authenticated', 'anon')
);
```

#### Policy 3: Allow users to delete their own photos
```sql
CREATE POLICY "Allow users to delete own photos"
ON storage.objects FOR DELETE USING (
  -- restrict bucket
  bucket_id = 'space-photos'
  -- allow access to image files
  AND storage."extension"(name) IN ('jpg', 'jpeg', 'png', 'webp')
  -- in the user's folder (user_id is first part of filename)
  AND auth.uid()::text = SPLIT_PART(name, '-', 1)
  -- to authenticated users
  AND auth.role() = 'authenticated'
);
```

#### Policy 4: Allow users to update their own photos
```sql
CREATE POLICY "Allow users to update own photos"
ON storage.objects FOR UPDATE USING (
  -- restrict bucket
  bucket_id = 'space-photos'
  -- allow access to image files
  AND storage."extension"(name) IN ('jpg', 'jpeg', 'png', 'webp')
  -- in the user's folder (user_id is first part of filename)
  AND auth.uid()::text = SPLIT_PART(name, '-', 1)
  -- to authenticated users
  AND auth.role() = 'authenticated'
);
```

## Troubleshooting Common Policy Errors

### Error: "Policy already exists"
If you get this error, the policy may already exist. You can:
1. Check existing policies in the "Policies" tab
2. Delete the existing policy and recreate it
3. Or use a different policy name

### Error: "Invalid bucket_id"
Make sure:
1. The bucket name is exactly `space-photos`
2. The bucket exists and is created
3. You're in the correct project

### Error: "Permission denied"
Ensure:
1. You're logged in as a project owner/admin
2. The bucket is created before adding policies
3. You have the necessary permissions

### Alternative: Use Supabase Dashboard UI
Instead of SQL, you can use the Supabase Dashboard:

1. **Go to Storage** → **space-photos** bucket
2. **Click "Policies"** tab
3. **Click "New Policy"**
4. **Choose "Create a policy from a template"**
5. **Select "Enable read access to everyone"** for public read
6. **Select "Enable insert for authenticated users only"** for uploads
7. **Select "Enable delete for users based on user_id"** for deletions

## Step 2: Database Schema Verification

Your database already has the correct schema for spaces and photos:

### Spaces Table
```sql
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  space_type TEXT NOT NULL,
  address TEXT NOT NULL,
  zip_code TEXT,
  price_per_hour DECIMAL NOT NULL,
  price_per_day DECIMAL,
  dimensions TEXT,
  available_from DATE,
  available_until DATE,
  owner_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Space Photos Table
```sql
CREATE TABLE space_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Step 3: Storage Configuration

### 3.1 File Size Limits
- Set maximum file size: 10MB per photo
- Supported formats: JPG, PNG, WebP
- Recommended dimensions: 1200x800px minimum

### 3.2 Storage Organization
- Files are stored as: `space-photos/{user_id}-{timestamp}.{extension}`
- This ensures unique filenames and easy user association

## Step 4: Testing the Setup

1. **Sign in** to your application
2. **Click "List Your Space"**
3. **Upload a photo** in the space listing form
4. **Verify** the photo appears in Supabase Storage
5. **Check** the photo URL is saved in the database

## Database Recommendations

### Current Schema Analysis

**✅ Strengths:**
- Proper relationships between tables
- User ownership tracking
- Flexible pricing (hourly/daily)
- Photo management with display order
- Availability date ranges
- Active/inactive status

**🔧 Recommended Improvements:**

### 1. Add Indexes for Performance
```sql
-- Add indexes for common queries
CREATE INDEX idx_spaces_owner_id ON spaces(owner_id);
CREATE INDEX idx_spaces_zip_code ON spaces(zip_code);
CREATE INDEX idx_spaces_space_type ON spaces(space_type);
CREATE INDEX idx_spaces_is_active ON spaces(is_active);
CREATE INDEX idx_spaces_available_from ON spaces(available_from);
CREATE INDEX idx_space_photos_space_id ON space_photos(space_id);
```

### 2. Add Constraints for Data Integrity
```sql
-- Add check constraints
ALTER TABLE spaces ADD CONSTRAINT check_price_per_hour 
  CHECK (price_per_hour >= 0);

ALTER TABLE spaces ADD CONSTRAINT check_price_per_day 
  CHECK (price_per_day IS NULL OR price_per_day >= 0);

ALTER TABLE spaces ADD CONSTRAINT check_available_dates 
  CHECK (available_from IS NULL OR available_until IS NULL OR available_from <= available_until);
```

### 3. Add Triggers for Updated Timestamps
```sql
-- Create function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to spaces table
CREATE TRIGGER update_spaces_updated_at 
  BEFORE UPDATE ON spaces 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 4. Add RLS (Row Level Security) Policies
```sql
-- Enable RLS on spaces table
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

-- Allow users to read all active spaces
CREATE POLICY "Allow read access to active spaces" ON spaces
FOR SELECT USING (is_active = true);

-- Allow users to manage their own spaces
CREATE POLICY "Allow users to manage own spaces" ON spaces
FOR ALL USING (auth.uid() = owner_id);

-- Enable RLS on space_photos table
ALTER TABLE space_photos ENABLE ROW LEVEL SECURITY;

-- Allow read access to photos of active spaces
CREATE POLICY "Allow read access to space photos" ON space_photos
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = space_photos.space_id 
    AND spaces.is_active = true
  )
);

-- Allow space owners to manage photos
CREATE POLICY "Allow space owners to manage photos" ON space_photos
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = space_photos.space_id 
    AND spaces.owner_id = auth.uid()
  )
);
```

## Step 5: Environment Variables

Add these to your environment configuration:

```env
# Supabase Storage
VITE_SUPABASE_STORAGE_URL=https://uwbkdjmmwmpnxjeuzogo.supabase.co/storage/v1
VITE_SUPABASE_STORAGE_BUCKET=space-photos

# File upload limits
VITE_MAX_FILE_SIZE=10485760  # 10MB in bytes
VITE_ALLOWED_FILE_TYPES=image/jpeg,image/png,image/webp
```

## Security Considerations

1. **File Validation**: Always validate file types and sizes on both client and server
2. **User Quotas**: Consider implementing upload limits per user
3. **Image Processing**: Consider adding image compression/optimization
4. **CDN**: Supabase Storage automatically serves files via CDN for better performance
5. **Backup**: Regularly backup your storage bucket

## Performance Tips

1. **Image Optimization**: Use WebP format for better compression
2. **Lazy Loading**: Implement lazy loading for space photos
3. **Caching**: Leverage Supabase Storage's built-in CDN caching
4. **Thumbnails**: Consider generating thumbnails for faster loading

## Quick Setup Checklist

- [ ] Create `space-photos` bucket in Supabase Storage
- [ ] Set bucket to public
- [ ] Add storage policies (4 policies total)
- [ ] Test photo upload in the app
- [ ] Verify photos appear in storage bucket
- [ ] Check database entries for space and photo data
