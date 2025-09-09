# Bagsy - AI-Powered Space Booking

## Project info

**URL**: https://lovable.dev/projects/a1c84b9e-3a02-49d9-9270-d0dd10c9a3ac

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/a1c84b9e-3a02-49d9-9270-d0dd10c9a3ac) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (Authentication & Database)
- Google OAuth Integration

## Authentication Features

The app now includes a complete authentication system with:

- **Email/Password Authentication**: Sign up and sign in with email and password
- **Google OAuth**: One-click sign in with Google accounts
- **Password Reset**: Forgot password functionality with email reset
- **User Profiles**: Automatic profile creation and management
- **Session Management**: Persistent login sessions
- **Apple-Style UI**: Beautiful, minimal authentication modals

### Authentication Flow

1. **Sign Up**: Users can create accounts with email/password or Google
2. **Sign In**: Existing users can sign in with their credentials
3. **Profile Creation**: User profiles are automatically created in the database
4. **Session Persistence**: Users stay logged in across browser sessions
5. **User Menu**: Signed-in users see a profile menu with options

### Supabase Configuration

The app is pre-configured with Supabase authentication. The database includes:
- User authentication tables
- User profiles table
- Bookings and spaces tables
- Proper relationships and constraints

### Google OAuth Setup

Google OAuth is now enabled in the authentication modal. To make it fully functional:

1. **Configure Google OAuth** in your Supabase dashboard:
   - Go to Authentication → Providers → Google
   - Enable the Google provider
   - Add your Google OAuth credentials

2. **Set up Google Cloud Console**:
   - Create OAuth 2.0 credentials
   - Add redirect URIs: `https://uwbkdjmmwmpnxjeuzogo.supabase.co/auth/v1/callback`
   - For development: `http://localhost:8080/auth/callback`

3. **Test the integration**:
   - Click "Sign In" → "Continue with Google"
   - Complete the OAuth flow
   - User profile will be automatically created

### Space Listing Feature

Users can now list their spaces for rent with a comprehensive form:

**Features:**
- **Space Information**: Title, description, type, dimensions
- **Location**: Address and ZIP code
- **Pricing**: Hourly and daily rates
- **Availability**: Date ranges for availability
- **Photo Upload**: Optional photo with show/hide toggle
- **Apple-Style UI**: Beautiful, intuitive interface

**Space Types Available:**
- Garage (Covered storage space)
- Driveway (Open parking space)
- Warehouse (Large commercial space)
- Parking Spot (Single parking space)
- Storage Unit (Indoor storage unit)
- Outdoor Space (Open outdoor area)

**Setup Required:**
1. **Create Storage Bucket**: Follow `STORAGE_SETUP.md` guide
2. **Configure Storage Policies**: Set up proper access controls
3. **Test Photo Upload**: Verify file upload functionality

**Database Storage:**
- Spaces stored in `spaces` table with owner relationship
- Photos stored in `space_photos` table with display order
- Automatic user association and profile creation

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/a1c84b9e-3a02-49d9-9270-d0dd10c9a3ac) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
