# Supabase Configuration for bagsy.space

This document outlines the required Supabase configuration changes to support the `bagsy.space` domain.

## Required Supabase Dashboard Updates

### 1. Authentication URL Configuration

Go to your Supabase dashboard: https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo

**Navigate to**: Authentication → URL Configuration

**Update the following settings**:

#### Site URL
- **Current**: (varies)
- **New**: `https://bagsy.space`

#### Redirect URLs
Add the following URLs to your redirect URLs list:
- `https://bagsy.space/auth/callback`
- `https://bagsy.space/auth/reset-password`
- `http://localhost:8080/auth/callback` (keep for development)

### 2. Google OAuth Configuration (if using Google OAuth)

**Navigate to**: Authentication → Providers → Google

**Update Google Cloud Console**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services → Credentials
3. Edit your OAuth 2.0 Client ID
4. Add to Authorized redirect URIs:
   - `https://bagsy.space/auth/callback`

### 3. CORS Configuration

**Navigate to**: Settings → API

**Update CORS settings** to allow:
- `https://bagsy.space`
- `http://localhost:8080` (for development)

### 4. Storage Configuration (if using file uploads)

**Navigate to**: Storage → Settings

**Update CORS settings** to allow:
- `https://bagsy.space`
- `http://localhost:8080` (for development)

## Code Changes Made

The following files have been updated in the codebase:

1. **`src/hooks/use-auth.ts`**:
   - Google OAuth redirect: `https://bagsy.space/auth/callback`
   - Password reset redirect: `https://bagsy.space/auth/reset-password`

2. **`AMPLIFY_DEPLOYMENT.md`**:
   - Updated deployment instructions for bagsy.space domain
   - Updated Supabase configuration steps

3. **`GOOGLE_OAUTH_SETUP.md`**:
   - Added bagsy.space to redirect URIs
   - Updated production domain references

4. **`README.md`**:
   - Updated Google OAuth setup instructions

## Testing Checklist

After making the Supabase dashboard changes:

- [ ] Test Google OAuth login from bagsy.space
- [ ] Test email/password authentication
- [ ] Test password reset functionality
- [ ] Test file uploads (if applicable)
- [ ] Verify all redirects work correctly
- [ ] Test on mobile devices

## Important Notes

1. **Domain Setup**: Ensure `bagsy.space` is properly configured in your hosting provider (AWS Amplify)
2. **SSL Certificate**: Verify SSL certificate is active for bagsy.space
3. **DNS**: Confirm DNS records point to the correct hosting provider
4. **Development**: Local development will continue to work with localhost URLs

## Troubleshooting

If authentication fails after the changes:

1. Check Supabase logs in the dashboard
2. Verify redirect URLs are exactly as specified
3. Ensure CORS settings allow bagsy.space
4. Test with browser developer tools to see network errors
5. Verify SSL certificate is valid for bagsy.space
