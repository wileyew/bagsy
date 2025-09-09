# Google OAuth Setup Guide

This guide will help you enable Google OAuth authentication in your Supabase project.

## Step 1: Create Google OAuth Credentials

### 1.1 Go to Google Cloud Console
- Visit [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select an existing one

### 1.2 Enable Google+ API
- Go to "APIs & Services" → "Library"
- Search for "Google+ API" and enable it

### 1.3 Create OAuth 2.0 Credentials
- Go to "APIs & Services" → "Credentials"
- Click "Create Credentials" → "OAuth 2.0 Client IDs"
- If prompted, set up OAuth consent screen first
- Choose "Web application" as the application type
- Add authorized redirect URIs:
  - `https://uwbkdjmmwmpnxjeuzogo.supabase.co/auth/v1/callback`
  - `http://localhost:8080/auth/callback` (for development)
- Note down your **Client ID** and **Client Secret**

## Step 2: Configure Supabase

### 2.1 Access Supabase Dashboard
- Go to [Supabase Dashboard](https://supabase.com/dashboard)
- Select your project: `uwbkdjmmwmpnxjeuzogo`

### 2.2 Enable Google Provider
- Navigate to "Authentication" → "Providers"
- Find "Google" in the list
- Click "Enable" to turn it on

### 2.3 Configure Google OAuth
- Enter your Google OAuth credentials:
  - **Client ID**: Your Google OAuth client ID
  - **Client Secret**: Your Google OAuth client secret
- Set the redirect URL to: `https://uwbkdjmmwmpnxjeuzogo.supabase.co/auth/v1/callback`
- Click "Save"

## Step 3: Enable Google Button in App

Once Google OAuth is configured in Supabase, uncomment the Google sign-in button in your app:

1. Open `src/components/auth/auth-modal.tsx`
2. Find the commented Google button section
3. Remove the comment markers (`/*` and `*/`)
4. Remove the setup message in the header

## Step 4: Test Google OAuth

1. Restart your development server
2. Click "Sign In" in your app
3. Click "Continue with Google"
4. You should be redirected to Google's OAuth consent screen
5. After authorization, you'll be redirected back to your app

## Troubleshooting

### Common Issues:

1. **"Unsupported provider" error**
   - Make sure Google provider is enabled in Supabase dashboard
   - Verify Client ID and Client Secret are correct

2. **Redirect URI mismatch**
   - Ensure redirect URIs in Google Cloud Console match Supabase settings
   - Check for typos in the URLs

3. **OAuth consent screen not configured**
   - Complete the OAuth consent screen setup in Google Cloud Console
   - Add your domain to authorized domains

### Development vs Production:

- **Development**: Use `http://localhost:8080/auth/callback`
- **Production**: Use `https://yourdomain.com/auth/callback`

## Security Notes

- Never commit your Client Secret to version control
- Use environment variables for sensitive credentials
- Regularly rotate your OAuth credentials
- Monitor OAuth usage in Google Cloud Console

## Next Steps

After setting up Google OAuth:

1. Test the authentication flow
2. Customize the OAuth consent screen
3. Add additional OAuth providers if needed (GitHub, Discord, etc.)
4. Implement user profile management
5. Add role-based access control
