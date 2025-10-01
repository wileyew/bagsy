# Driver's License Upload Debugging Guide

## Common Issue: Upload Stuck on "Uploading..."

If the driver's license upload is stuck on "Uploading..." phase, here are the common causes and fixes:

## Root Causes

### 1. Storage Bucket Doesn't Exist ❌

**Problem**: The `driver-licenses` bucket hasn't been created yet.

**Check**:
```sql
-- In Supabase SQL Editor, run:
SELECT * FROM storage.buckets WHERE name = 'driver-licenses';
```

**Fix Option A - Run Migration**:
```bash
# Via Supabase Dashboard:
1. Go to SQL Editor
2. Paste contents of: supabase/migrations/20250201000001_add_driver_license_verification.sql
3. Click Run

# Via Supabase CLI:
npx supabase db push
```

**Fix Option B - Manual Creation**:
```sql
-- In Supabase SQL Editor, run:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-licenses',
  'driver-licenses',
  false,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
```

**Fix Option C - Node Script**:
```bash
# Set service role key:
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"

# Run script:
node scripts/create-storage-buckets.js
```

---

### 2. RLS Policies Not Set ❌

**Problem**: Row Level Security policies block uploads.

**Check Browser Console**:
Look for error like:
```
new row violates row-level security policy
```

**Fix**:
```sql
-- In Supabase SQL Editor, run these policies:

-- Allow uploads
CREATE POLICY "Users can upload their own driver license"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-licenses' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow reads
CREATE POLICY "Users can read their own driver license"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-licenses' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow updates
CREATE POLICY "Users can update their own driver license"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-licenses' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);
```

---

### 3. User Not Authenticated ❌

**Problem**: User session expired or not logged in.

**Check**:
```javascript
// Open browser console and run:
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
```

**Fix**:
- Log out and log back in
- Check if `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set correctly

---

### 4. Profile Record Doesn't Exist ❌

**Problem**: User doesn't have a profile record to update.

**Check**:
```sql
-- In Supabase SQL Editor, run:
SELECT * FROM profiles WHERE user_id = 'YOUR_USER_ID_HERE';
```

**Fix**:
```sql
-- Create profile if missing:
INSERT INTO profiles (user_id, full_name)
VALUES ('YOUR_USER_ID_HERE', 'Your Name')
ON CONFLICT (user_id) DO NOTHING;
```

---

### 5. File Size Too Large ❌

**Problem**: File exceeds 10MB limit.

**Check Browser Console**:
Look for error like:
```
Payload too large
```

**Fix**:
- Resize the image before uploading
- Or increase bucket limit:

```sql
UPDATE storage.buckets
SET file_size_limit = 20971520 -- 20MB
WHERE name = 'driver-licenses';
```

---

### 6. CORS Issues ❌

**Problem**: Browser blocking cross-origin requests.

**Check Browser Console**:
Look for CORS errors

**Fix**:
- Supabase should handle this automatically
- If issue persists, check Supabase dashboard > Settings > API > CORS

---

## Debug Steps

### Step 1: Enable Console Logging

The upload component now has extensive logging. Open **Browser Developer Tools** (F12) and check the Console tab.

You should see:
```
Starting driver license upload... {userId: "...", fileName: "...", fileSize: ..., fileType: "..."}
Available buckets: ["space-photos", "driver-licenses"]
Uploading to storage... {fileName: "..."}
Upload result: {uploadData: {...}, uploadError: null}
Got public URL: https://...
Updating profile...
Profile updated successfully
```

### Step 2: Identify Where It Stops

The logs will show exactly where the upload fails:

| Log Message | Status | Next Step |
|-------------|--------|-----------|
| "Starting driver license upload" | ✅ Started | Good start |
| "Available buckets: []" | ❌ No buckets | Create buckets (see Fix 1) |
| "Upload error details" | ❌ Upload failed | Check error message |
| "Profile update error" | ❌ DB update failed | Check profiles table |
| "Profile updated successfully" | ✅ Complete | Success! |

### Step 3: Check Network Tab

1. Open **Developer Tools** > **Network** tab
2. Filter by "Fetch/XHR"
3. Try uploading again
4. Look for failed requests (red)
5. Click on failed request to see error details

---

## Quick Diagnostic Checklist

Run these checks in order:

```javascript
// 1. Check authentication
const { data: { session } } = await supabase.auth.getSession();
console.log('Authenticated:', !!session);

// 2. Check buckets exist
const { data: buckets } = await supabase.storage.listBuckets();
console.log('Buckets:', buckets.map(b => b.name));

// 3. Check profile exists
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('user_id', session.user.id)
  .single();
console.log('Profile exists:', !!profile);

// 4. Test upload permission
const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
const { data, error } = await supabase.storage
  .from('driver-licenses')
  .upload(`${session.user.id}/test.txt`, testFile);
console.log('Upload test:', { success: !error, error });

// 5. Clean up test file
if (!error) {
  await supabase.storage
    .from('driver-licenses')
    .remove([`${session.user.id}/test.txt`]);
}
```

---

## Most Likely Fix (90% of cases)

**Problem**: Migration hasn't been run, bucket doesn't exist.

**Solution**: Run the migration

```bash
# Option 1: Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo/editor
2. Click SQL Editor
3. Paste: supabase/migrations/20250201000001_add_driver_license_verification.sql
4. Run

# Option 2: Quick SQL (copy-paste this)
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-licenses', 'driver-licenses', false)
ON CONFLICT (id) DO NOTHING;
```

Then refresh the page and try uploading again.

---

## Still Stuck?

### Enable Maximum Debugging

Add this to your `.env.local`:
```bash
VITE_DEBUG=true
```

### Check Supabase Logs

1. Go to Supabase Dashboard
2. Logs → API Logs
3. Filter by "storage"
4. Look for errors during upload attempt

### Test with Simple Upload

Create a test page:
```typescript
// test-upload.tsx
export default function TestUpload() {
  const handleTest = async () => {
    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const { data: session } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.storage
      .from('driver-licenses')
      .upload(`${session.data.session.user.id}/test.txt`, file);
    
    console.log({ data, error });
  };

  return <button onClick={handleTest}>Test Upload</button>;
}
```

---

## Summary

**99% of the time**, the issue is:
1. ❌ Storage bucket doesn't exist → Run migration
2. ❌ RLS policies not set → Run migration
3. ❌ User not logged in → Check auth state

**After running the migration**, uploads should work immediately.

