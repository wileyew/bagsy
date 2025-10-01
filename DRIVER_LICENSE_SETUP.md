# Driver's License Verification Setup Guide

## Overview
We've implemented driver's license verification for space listings and simplified the relisting functionality as requested.

## Features Added

### 1. Driver's License Verification
- **Required for Listings**: Users must upload their driver's license before creating a space listing
- **Secure Storage**: Licenses are stored in a dedicated `driver-licenses` bucket with RLS policies
- **Privacy Protected**: Files are encrypted, user-specific, and can be deleted anytime
- **Verification Status**: Tracks whether the license has been verified by admin/AI

### 2. Simplified Relisting
- **Streamlined UX**: Simplified modal that only asks for the next reservation time window
- **Current Space Info**: Shows existing space details for context
- **Timezone Support**: Automatically uses the space's configured timezone
- **Instant Activation**: Reactivates the space immediately upon relisting

## Database Migration Required

You need to apply the migration to add the driver's license fields to your Supabase database:

### Option 1: Using Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20250201000001_add_driver_license_verification.sql`
4. Click **Run** to execute the migration

### Option 2: Using Supabase CLI
```bash
# Link your project (if not already linked)
npx supabase link --project-ref uwbkdjmmwmpnxjeuzogo

# Push the migration
npx supabase db push
```

## New Database Fields

The migration adds these fields to the `profiles` table:
- `driver_license_url` (TEXT): URL to the uploaded license image
- `driver_license_verified` (BOOLEAN): Verification status (default: false)
- `driver_license_uploaded_at` (TIMESTAMP): Upload timestamp

## Storage Bucket

A new storage bucket `driver-licenses` is created with these policies:
- Users can upload their own license (folder structure: `{user_id}/driver-license-*.{ext}`)
- Users can read/update/delete their own license
- Admins can read all licenses for verification purposes

## How It Works

### Listing Flow
1. User clicks "List Your Driveway"
2. **NEW**: System checks if user has uploaded a driver's license
3. **NEW**: If no license, shows upload screen with security assurances
4. Once uploaded, proceeds to photo upload step
5. Rest of the flow remains the same (AI analysis, review, confirm)

### Relisting Flow
1. User clicks "Relist" on an inactive space
2. Modal shows current space info and asks for:
   - Available From (datetime)
   - Available Until (datetime)
   - Timezone (pre-filled from space)
3. On submit, space is reactivated with new dates

## Components Created/Modified

### New Components
- `src/components/auth/driver-license-upload.tsx`: Reusable driver's license upload component

### Modified Components
- `src/components/spaces/ai-space-listing-modal.tsx`: Added license verification step
- `src/components/spaces/relist-modal.tsx`: Simplified to only ask for time window
- `src/integrations/supabase/types.ts`: Added driver license fields to Profile type

## TypeScript Types Updated

```typescript
profiles: {
  Row: {
    driver_license_url: string | null
    driver_license_verified: boolean
    driver_license_uploaded_at: string | null
    // ... other fields
  }
}
```

## User Experience

### License Upload
- Clean, Apple-inspired UI with security badges
- Drag-and-drop or click to upload
- Supports JPG, PNG, WebP (max 10MB)
- Shows verification status (Pending/Verified)
- Can remove and re-upload anytime

### Relisting
- Quick 2-field form (start/end dates)
- Visual space info card
- Better date validation (min dates)
- Clear success feedback with formatted dates

## Next Steps

1. **Apply the database migration** (see above)
2. **Test the flow**:
   - Try listing a space without a license (should show upload screen)
   - Upload a driver's license
   - Complete a listing
   - Try relisting an inactive space
3. **(Optional) Set up admin verification**:
   - Create an admin interface to review uploaded licenses
   - Update `driver_license_verified` field after manual review
   - Or integrate AI-based ID verification service

## Security Notes

- All license photos are stored securely in Supabase Storage
- RLS policies ensure users can only access their own licenses
- Files are organized by user ID for isolation
- Verification status prevents unverified users from listing (optional enforcement)

## Future Enhancements

Consider adding:
- AI-powered license verification (e.g., using AWS Rekognition or similar)
- Email notifications when license is verified
- Expiration date tracking from the license
- Admin dashboard for manual verification
- Verification badges on user profiles

