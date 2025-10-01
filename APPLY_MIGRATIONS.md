# 🗄️ Database Migration Guide - Apply Booking System Updates

## ⚠️ **IMPORTANT: You Must Apply This Migration**

The new booking system features **require database schema updates**. Without applying the migration, the booking system will fail.

---

## 🎯 **What This Migration Does:**

### **Updates Existing Tables:**
- ✅ Adds 12 new columns to `bookings` table
- ✅ Updates `bookings` status constraint for new states
- ✅ Adds 2 new columns to `negotiations` table
- ✅ Backfills `owner_id` in existing bookings

### **Creates New Tables:**
- ✅ `agreements` - Digital contract signatures
- ✅ `notifications` - Email/SMS notification tracking

### **Adds Security:**
- ✅ Row-Level Security (RLS) policies for all tables
- ✅ Updated RLS policies for enhanced features
- ✅ Performance indexes on all foreign keys

---

## 🚀 **How to Apply Migration:**

### **Option 1: Using Supabase CLI (Recommended)**

```bash
# Navigate to project directory
cd /Users/evanwiley/Development/bagsy

# Login to Supabase (if not already)
npx supabase login

# Link to your project (if not already linked)
npx supabase link --project-ref YOUR_PROJECT_REF

# Apply the migration
npx supabase db push

# Verify migration applied
npx supabase db remote ls
```

### **Option 2: Using Supabase Dashboard**

1. Go to https://supabase.com/dashboard
2. Select your Bagsy project
3. Navigate to **SQL Editor**
4. Click **+ New Query**
5. Copy the entire contents of:
   ```
   /Users/evanwiley/Development/bagsy/supabase/migrations/20250103000003_update_booking_system.sql
   ```
6. Paste into the SQL Editor
7. Click **Run** (green play button)
8. Verify success message

### **Option 3: Direct SQL Execution**

```bash
# Copy migration to clipboard
cat /Users/evanwiley/Development/bagsy/supabase/migrations/20250103000003_update_booking_system.sql | pbcopy

# Then paste into Supabase Dashboard > SQL Editor
```

---

## ✅ **Verification Steps:**

After applying the migration, verify in Supabase Dashboard:

### **Check Bookings Table:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings' 
ORDER BY ordinal_position;
```

Should show **23 columns** including:
- `owner_id`
- `license_plate`
- `payment_status`
- `legal_compliance_checked`
- `legal_compliance_status`
- `legal_compliance_details`

### **Check New Tables Exist:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('agreements', 'notifications');
```

Should return **2 rows**.

### **Check Indexes:**
```sql
SELECT indexname 
FROM pg_indexes 
WHERE tablename IN ('bookings', 'negotiations', 'agreements', 'notifications');
```

Should show **20+ indexes**.

---

## 🎨 **What Each New Column Does:**

### **Bookings Table New Columns:**

| Column | Type | Purpose |
|--------|------|---------|
| `owner_id` | UUID | Space owner for quick queries |
| `original_price` | DECIMAL | Original listed price/hr |
| `final_price` | DECIMAL | Negotiated final price/hr |
| `license_plate` | TEXT | Renter's vehicle plate |
| `payment_intent_id` | TEXT | Stripe payment ID |
| `payment_status` | TEXT | pending/succeeded/failed |
| `legal_compliance_checked` | BOOLEAN | Was compliance verified? |
| `legal_compliance_status` | TEXT | allowed/restricted/prohibited |
| `legal_compliance_details` | JSONB | Full compliance results |
| `confirmed_at` | TIMESTAMP | When booking confirmed |
| `completed_at` | TIMESTAMP | When rental completed |
| `cancelled_at` | TIMESTAMP | When cancelled (if any) |

### **New Status Values:**
- `negotiating` - Active price discussions
- `accepted` - Price agreed, awaiting payment
- `rejected` - Offer rejected by owner
- `active` - Rental in progress

---

## 🔐 **Security (RLS Policies):**

All tables have proper Row-Level Security:

### **Bookings:**
- ✅ Renters can view/update their bookings
- ✅ Owners can view/update bookings for their spaces
- ✅ No one can access other people's bookings

### **Negotiations:**
- ✅ Only involved parties can view
- ✅ Only sender can create
- ✅ Only recipient can respond

### **Agreements:**
- ✅ Only renter and owner can view
- ✅ Each party can sign their side
- ✅ Cannot modify after fully executed

### **Notifications:**
- ✅ Users can only view their own
- ✅ Users can mark as read
- ✅ System can create for anyone

---

## ⚡ **Performance Indexes:**

The migration creates 20+ indexes for fast queries:
- Booking lookups by user, space, status
- Negotiation tracking by booking
- Agreement retrieval by booking
- Notification filtering and sorting

---

## 🧪 **Test After Migration:**

```javascript
// In browser console after migration:
seedTestData()
```

This will create:
- 3 test spaces
- 1 booking with negotiations
- Sample notifications

Then test the flow:
1. Go to "My Bookings"
2. Click on test booking
3. See negotiations panel
4. Try accepting/countering offers

---

## 🆘 **Troubleshooting:**

### **Error: "column already exists"**
✅ Safe to ignore - migration uses `ADD COLUMN IF NOT EXISTS`

### **Error: "constraint already exists"**
✅ Migration drops old constraints before creating new ones

### **Error: "table already exists"**
✅ Safe - migration uses `CREATE TABLE IF NOT EXISTS`

### **Foreign Key Violations:**
```sql
-- Check for orphaned bookings
SELECT b.id, b.space_id 
FROM bookings b 
LEFT JOIN spaces s ON b.space_id = s.id 
WHERE s.id IS NULL;

-- Fix by deleting orphaned records
DELETE FROM bookings WHERE space_id NOT IN (SELECT id FROM spaces);
```

---

## 📊 **Migration File Location:**

```
/Users/evanwiley/Development/bagsy/supabase/migrations/20250103000003_update_booking_system.sql
```

Size: 215 lines
Safe: Yes (uses IF NOT EXISTS, won't drop existing data)
Backwards Compatible: Yes (only adds, doesn't remove)

---

## ✅ **After Migration Success:**

You'll be able to:
- ✅ Create bookings with full negotiation support
- ✅ Use AI agents for automated negotiation
- ✅ Sign digital agreements
- ✅ Process payments with license plates
- ✅ Check legal compliance
- ✅ Receive notifications
- ✅ Track complete booking lifecycle

---

## 🎉 **Ready to Apply!**

Choose your preferred method above and run the migration. The entire booking system will then be fully operational!

**Estimated Time:** 5-10 seconds  
**Downtime:** None  
**Data Loss Risk:** Zero  

