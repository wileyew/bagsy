# Google Authentication Debugging Guide

## Enhanced Logging Added

I've added comprehensive console logging throughout the Google OAuth flow. You'll now see:

### When Clicking "Sign in with Google"

```javascript
🔐 Initiating Google sign-in...
Current origin: http://localhost:8080
Expected redirect: http://localhost:8080/auth/callback
🔑 Calling Supabase OAuth with Google... {provider: "google", redirectTo: "..."}
Supabase OAuth response: {hasData: true, hasError: false, provider: "google", url: "URL generated"}
✅ Google sign-in initiated successfully
Redirecting to Google OAuth...
```

### When Returning to /auth/callback

```javascript
🔄 Auth callback page loaded
Current URL: http://localhost:8080/auth/callback?code=...
URL params: ?code=...&state=...
Getting session from Supabase...
Session response: {hasSession: true, userId: "...", email: "..."}
✅ Session found! Redirecting to home...
```

---

## Common Issues & Fixes

### Issue 1: "Redirect URL mismatch" Error ❌

**Symptoms:**
- Stuck on Google sign-in page
- Error in URL params: `error=redirect_uri_mismatch`
- Console shows: `❌ OAuth error in URL: {errorParam: "redirect_uri_mismatch"}`

**Root Cause:** Supabase doesn't have `http://localhost:8080/auth/callback` in allowed URLs

**Fix:**
1. Go to: https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo/auth/url-configuration
2. Under **"Redirect URLs"**, add:
   ```
   http://localhost:8080/auth/callback
   http://localhost:8080/*
   ```
3. Under **"Site URL"**, make sure you have:
   ```
   http://localhost:8080
   ```
4. Click **Save**
5. Wait 1-2 minutes for changes to propagate
6. Try signing in again

---

### Issue 2: Google OAuth Not Configured ❌

**Symptoms:**
- Error: "Provider not enabled"
- Console shows: `error: {message: "Provider google is not enabled"}`

**Root Cause:** Google OAuth provider not enabled in Supabase

**Fix:**
1. Go to: https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo/auth/providers
2. Find **Google** in the list
3. Click **Enable**
4. Configure:
   - **Client ID**: Your Google OAuth client ID
   - **Client Secret**: Your Google OAuth client secret
5. Click **Save**

**Need Google OAuth credentials?** See: `/GOOGLE_OAUTH_SETUP.md` or:
1. Go to: https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://uwbkdjmmwmpnxjeuzogo.supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase

---

### Issue 3: Session Not Created After Redirect ❌

**Symptoms:**
- Redirects to /auth/callback
- Console shows: `⚠️ No session found after OAuth`
- Redirects back to home but not logged in

**Root Cause:** Hash fragment vs query parameters

**Check Console:**
```javascript
Current URL: http://localhost:8080/auth/callback#access_token=...
```

If you see `#` instead of `?`, that's a hash fragment issue.

**Fix:**
The code should handle this automatically, but if not:

```typescript
// In AuthCallback.tsx, add:
const handleAuthCallback = async () => {
  // Check for hash fragment (OAuth implicit flow)
  if (window.location.hash) {
    console.log('Hash fragment detected:', window.location.hash);
    // Supabase should auto-parse this
  }
  
  // ... rest of code
};
```

---

### Issue 4: Network/CORS Errors ❌

**Symptoms:**
- Console shows CORS errors
- Network tab shows failed requests

**Fix:**
1. Check Supabase API settings
2. Ensure CORS is properly configured
3. Make sure you're using the correct Supabase URL

---

### Issue 5: Pop-up Blocked ❌

**Symptoms:**
- Nothing happens when clicking "Sign in with Google"
- Browser shows "Pop-up blocked" notification

**Fix:**
- Allow pop-ups for localhost:8080
- Or use redirect flow (current implementation)

---

## Step-by-Step Debugging

### Step 1: Check Console on Button Click

When you click "Sign in with Google", you should see:

```javascript
✅ Good:
🔐 Initiating Google sign-in...
🔑 Calling Supabase OAuth with Google...
Supabase OAuth response: {hasData: true, url: "URL generated"}
✅ Google sign-in initiated successfully

❌ Bad:
❌ Google sign-in error: {message: "Provider google is not enabled"}
→ Fix: Enable Google in Supabase Auth Providers

❌ Bad:
Supabase OAuth response: {hasData: false, hasError: true}
→ Check the error details in console
```

### Step 2: Check Google OAuth Page

After clicking, you should be redirected to Google's OAuth page.

```
✅ Good: You see Google's sign-in page
❌ Bad: Error page or redirect back immediately
→ Check redirect URL configuration
```

### Step 3: Check Callback URL

After signing in with Google, check the URL you land on:

```
✅ Good: http://localhost:8080/auth/callback?code=...
❌ Bad: http://localhost:8080/auth/callback?error=redirect_uri_mismatch
→ Fix redirect URLs in Supabase
```

### Step 4: Check Callback Console

Once on /auth/callback, check console:

```javascript
✅ Good:
🔄 Auth callback page loaded
Current URL: http://localhost:8080/auth/callback?code=...
Getting session from Supabase...
Session response: {hasSession: true, userId: "...", email: "..."}
✅ Session found! Redirecting to home...

❌ Bad:
❌ OAuth error in URL: {errorParam: "redirect_uri_mismatch"}
→ Fix: Add redirect URL to Supabase

❌ Bad:
⚠️ No session found after OAuth
→ Check Google OAuth credentials
```

---

## Quick Checklist

Before testing, ensure:

- [ ] Google OAuth is **enabled** in Supabase (Auth → Providers)
- [ ] Google Client ID and Secret are **configured** in Supabase
- [ ] **Redirect URLs** include `http://localhost:8080/auth/callback`
- [ ] **Site URL** is `http://localhost:8080`
- [ ] Google Cloud Console has redirect URI: `https://uwbkdjmmwmpnxjeuzogo.supabase.co/auth/v1/callback`
- [ ] Browser console is open (F12) to see logs
- [ ] No browser extensions blocking OAuth

---

## Configuration Required

### 1. Supabase Dashboard

**URL Configuration:**
```
Go to: Authentication → URL Configuration

Redirect URLs:
  http://localhost:8080/auth/callback
  http://localhost:8080/*
  https://bagsy.space/auth/callback
  https://bagsy.space/*

Site URL:
  http://localhost:8080 (for development)
  https://bagsy.space (for production)
```

**Provider Configuration:**
```
Go to: Authentication → Providers → Google

Enabled: ON
Client ID: [Your Google OAuth Client ID]
Client Secret: [Your Google OAuth Client Secret]
```

### 2. Google Cloud Console

```
Go to: https://console.cloud.google.com/apis/credentials

OAuth 2.0 Client IDs:
  Authorized JavaScript origins:
    http://localhost:8080
    https://bagsy.space
    
  Authorized redirect URIs:
    https://uwbkdjmmwmpnxjeuzogo.supabase.co/auth/v1/callback
```

---

## Test Scenarios

### Test 1: Basic Flow
1. Click "Sign in with Google"
2. Check console for logs
3. Should redirect to Google
4. Sign in with Google account
5. Should redirect back to /auth/callback
6. Should redirect to home page (logged in)

### Test 2: Error Handling
1. Disable Google in Supabase providers
2. Click "Sign in with Google"
3. Should see error toast
4. Console should show error details

### Test 3: Callback with Error
1. Manually navigate to: `http://localhost:8080/auth/callback?error=access_denied`
2. Should see error page
3. Should show "Authentication Error"

---

## Most Common Fix (90% of cases)

**Problem:** Redirect URL not configured in Supabase

**Solution:**
1. Go to https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo/auth/url-configuration
2. Add `http://localhost:8080/auth/callback` to Redirect URLs
3. Click Save
4. Wait 1-2 minutes
5. Try again

---

## Still Not Working?

Share the console output from these steps:

1. Click "Sign in with Google"
2. Copy ALL console logs (starting with 🔐)
3. Check what URL you land on after Google sign-in
4. Copy the URL if it contains an error
5. Share the error message

The enhanced logging will show exactly where it's failing!

