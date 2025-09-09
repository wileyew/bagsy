# AWS Amplify Deployment Guide

This guide will help you deploy your PocketSpot application to AWS Amplify.

## Prerequisites

1. **AWS Account**: You need an active AWS account
2. **GitHub Repository**: Your code should be pushed to a GitHub repository
3. **Supabase Project**: Ensure your Supabase project is set up and running

## Deployment Steps

### 1. Connect Repository to Amplify

1. Go to the [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Click "New app" → "Host web app"
3. Choose "GitHub" as your source
4. Authorize GitHub and select your repository
5. Select the branch you want to deploy (usually `main`)

### 2. Configure Build Settings

Amplify will automatically detect the `amplify.yml` file in your repository root. The configuration includes:

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Node Version**: Latest LTS (automatically detected)

### 3. Environment Variables

In the Amplify console, go to "Environment variables" and add:

```
VITE_SUPABASE_URL=https://uwbkdjmmwmpnxjeuzogo.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3Ymtkam1td21wbnhqZXV6b2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MTA3NDUsImV4cCI6MjA3MjQ4Njc0NX0.BUGFv4V7xSnkSEoioa39w4rANH2pl4UACkCvBWpNk3I
VITE_APP_NAME=PocketSpot
VITE_APP_DESCRIPTION=AI-Powered Space Booking
```

### 4. Custom Domain (Optional)

1. In Amplify console, go to "Domain management"
2. Click "Add domain"
3. Enter your custom domain
4. Follow the DNS configuration instructions

### 5. Redirects Configuration

The `_redirects` file in the `public` folder ensures proper SPA routing:
- All routes redirect to `index.html` with a 200 status code
- This allows React Router to handle client-side routing

## Build Configuration

The `amplify.yml` file configures:

- **Pre-build**: Runs `npm ci` to install dependencies
- **Build**: Runs `npm run build` to create production build
- **Artifacts**: Serves files from the `dist` directory
- **Cache**: Caches `node_modules` for faster builds

## Vite Configuration

The updated `vite.config.ts` includes:

- **Build optimization**: Code splitting for vendor and Supabase libraries
- **Asset optimization**: Proper asset directory structure
- **Source maps**: Disabled for production builds

## Post-Deployment

### 1. Update Supabase Auth Settings

In your Supabase dashboard:

1. Go to Authentication → URL Configuration
2. Add your Amplify domain to "Site URL"
3. Add `https://your-domain.amplifyapp.com/auth/callback` to "Redirect URLs"

### 2. Test Authentication

1. Visit your deployed app
2. Test email/password authentication
3. Test Google OAuth (if configured)
4. Verify user profiles are created correctly

### 3. Test Space Listing

1. Sign in to your app
2. Test the space listing functionality
3. Verify photo uploads work (if storage is configured)

## Troubleshooting

### Build Failures

- Check that all dependencies are in `package.json`
- Verify Node.js version compatibility
- Check build logs in Amplify console

### Authentication Issues

- Verify Supabase URL and keys are correct
- Check redirect URLs in Supabase dashboard
- Ensure CORS settings allow your domain

### Routing Issues

- Verify `_redirects` file is in the `public` folder
- Check that all routes redirect to `index.html`

## Performance Optimization

The build configuration includes:

- **Code splitting**: Separates vendor libraries from app code
- **Asset optimization**: Proper caching headers
- **Bundle analysis**: Monitor bundle sizes in Amplify console

## Security Considerations

- Environment variables are securely stored in Amplify
- Supabase keys are public (anon key) and safe to expose
- Authentication is handled server-side by Supabase

## Monitoring

- Use Amplify console to monitor build status
- Check Supabase dashboard for authentication metrics
- Monitor application performance in AWS CloudWatch
