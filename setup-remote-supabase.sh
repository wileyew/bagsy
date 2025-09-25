#!/bin/bash

# Supabase Remote Connection Setup Script
# Run this script to connect to your remote Supabase instance

echo "🚀 Setting up Supabase remote connection..."

# Check if access token is provided
if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "❌ SUPABASE_ACCESS_TOKEN environment variable not set"
    echo ""
    echo "To get your access token:"
    echo "1. Go to https://supabase.com/dashboard"
    echo "2. Click your profile → Access Tokens"
    echo "3. Generate a new token"
    echo "4. Run: export SUPABASE_ACCESS_TOKEN='your_token_here'"
    echo "5. Then run this script again"
    exit 1
fi

echo "✅ Access token found"

# Login to Supabase
echo "🔐 Logging in to Supabase..."
npx supabase login --token $SUPABASE_ACCESS_TOKEN

if [ $? -eq 0 ]; then
    echo "✅ Successfully logged in"
else
    echo "❌ Login failed"
    exit 1
fi

# Link the project
echo "🔗 Linking to project uwbkdjmmwmpnxjeuzogo..."
npx supabase link --project-ref uwbkdjmmwmpnxjeuzogo

if [ $? -eq 0 ]; then
    echo "✅ Successfully linked to project"
else
    echo "❌ Project linking failed"
    exit 1
fi

# Push migrations
echo "📤 Pushing migrations to remote database..."
npx supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Migrations pushed successfully!"
    echo ""
    echo "🎉 Your remote Supabase database is now updated!"
    echo "The timezone column error should be resolved."
else
    echo "❌ Migration push failed"
    echo "You can still run the SQL scripts manually in the Supabase dashboard"
fi
