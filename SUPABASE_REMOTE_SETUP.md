# Supabase Remote Connection Guide

## Quick Fix (Recommended)

### Option 1: Manual SQL Execution (Easiest)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/uwbkdjmmwmpnxjeuzogo)
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `fix-timezone-column.sql`
4. Click **Run**
5. (Optional) Copy and paste the contents of `create-ai-tables.sql`
6. Click **Run**

### Option 2: Using Supabase CLI
1. Get your access token from [Supabase Dashboard](https://supabase.com/dashboard) → Profile → Access Tokens
2. Set the token: `export SUPABASE_ACCESS_TOKEN="your_token_here"`
3. Run the setup script: `./setup-remote-supabase.sh`

## Detailed CLI Setup

### Step 1: Authentication
```bash
# Get your access token from Supabase Dashboard
export SUPABASE_ACCESS_TOKEN="your_access_token_here"

# Login to Supabase
npx supabase login --token $SUPABASE_ACCESS_TOKEN
```

### Step 2: Link Project
```bash
npx supabase link --project-ref uwbkdjmmwmpnxjeuzogo
```

### Step 3: Push Migrations
```bash
npx supabase db push
```

## Alternative: Direct Database Connection

If you have database credentials, you can also connect directly:

```bash
# Using psql (if you have PostgreSQL client)
psql "postgresql://postgres:[password]@db.uwbkdjmmwmpnxjeuzogo.supabase.co:5432/postgres"

# Using any PostgreSQL client
# Host: db.uwbkdjmmwmpnxjeuzogo.supabase.co
# Port: 5432
# Database: postgres
# Username: postgres
# Password: [your database password]
```

## Troubleshooting

### If CLI doesn't work:
- Use the **SQL Editor** in Supabase Dashboard (easiest option)
- Run the SQL scripts manually

### If you get permission errors:
- Make sure you're using the correct access token
- Verify you have admin access to the project

### If migrations fail:
- Check the SQL syntax in the scripts
- Run them one section at a time
- Use `IF NOT EXISTS` clauses to avoid conflicts
