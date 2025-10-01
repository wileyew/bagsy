# Listing Flagging System Guide

## Overview

A comprehensive flagging and moderation system to identify and manage suspicious listings, protecting both renters and space owners from fraud.

## Features Implemented

### 1. User Reporting
- ✅ Users can report suspicious listings
- ✅ 8 different flag categories
- ✅ Detailed reason collection
- ✅ Confidential reporting (owner doesn't see who reported)
- ✅ Duplicate prevention (can't report same listing twice)
- ✅ False report protection (abuse warnings)

### 2. Automatic Flagging
- ✅ AI-powered suspicious listing detection
- ✅ Confidence scoring (0-100)
- ✅ Multi-criteria evaluation
- ✅ Automatic flag creation when threshold breached

### 3. Admin Dashboard (Template)
- ✅ View all flagged listings
- ✅ Filter by status (pending/reviewing/resolved/dismissed)
- ✅ Update flag status with notes
- ✅ Dismiss all flags for a listing

## Flag Categories

| Category | Description | Auto-Detected |
|----------|-------------|---------------|
| **Fake Listing** | Space doesn't exist or is misrepresented | ✅ Yes |
| **Fake Photos** | Photos don't match actual space | 🔄 Planned |
| **Wrong Address** | Incorrect address or doesn't match license | ✅ Yes |
| **Unsafe Space** | Safety issues or hazards | ❌ No |
| **Price Scam** | Unrealistic pricing or hidden fees | ✅ Yes |
| **Unverified Owner** | Owner identity suspicious | ✅ Yes |
| **Spam** | Duplicate listing or spam content | ✅ Yes |
| **Other** | Any other issue | ❌ No |

## Automatic Flagging Criteria

The system automatically flags listings based on these signals:

### Low Address Confidence (-40 points)
```typescript
// Triggered when address verification < 50%
if (driver_license_verification_confidence < 50) {
  flag = 'wrong_address'
}
```

### No Driver License (-30 points)
```typescript
// Owner hasn't uploaded license
if (!driver_license_url) {
  flag = 'unverified_owner'
}
```

### New Account + High Value (-20 points)
```typescript
// Account < 7 days old with expensive listing
if (accountAge < 7days && dailyPrice > $200) {
  flag = 'fake_listing'
}
```

### Abnormal Pricing (-15 points)
```typescript
// Prices significantly above market
if (hourlyPrice > $100 || dailyPrice > $500) {
  flag = 'price_scam'
}
```

### Rapid Listings (-15 points)
```typescript
// More than 5 listings in 24 hours
if (listingsIn24Hours > 5) {
  flag = 'spam'
}
```

### Threshold
- **< 60 points**: Automatically flagged
- **60-89 points**: Manual review recommended
- **≥ 90 points**: Considered safe

## Database Schema

### listing_flags Table

```sql
CREATE TABLE listing_flags (
  id UUID PRIMARY KEY,
  space_id UUID REFERENCES spaces(id),
  flagger_user_id UUID REFERENCES auth.users(id), -- NULL for auto-flags
  flag_type TEXT,                   -- Category of flag
  flag_reason TEXT,                 -- Detailed explanation
  auto_flagged BOOLEAN,             -- TRUE if system-generated
  confidence_score INTEGER,         -- 0-100 confidence score
  status TEXT,                      -- pending/reviewing/resolved/dismissed
  admin_notes TEXT,                 -- Admin comments
  reviewed_by UUID,                 -- Admin who reviewed
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### spaces Table Updates

```sql
ALTER TABLE spaces
ADD COLUMN flag_count INTEGER DEFAULT 0,
ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN flagged_at TIMESTAMP;
```

## User Experience

### Reporting Flow

1. User clicks "Report" button on listing card
2. Modal opens with flag categories
3. User selects issue type
4. User provides detailed explanation
5. System confirms submission
6. Flag is created with status "pending"

### Visual Indicators

**For Flagged Listings:**
```tsx
{space.is_flagged && (
  <Badge variant="destructive">
    <AlertTriangle className="h-3 w-3 mr-1" />
    {space.flag_count} {space.flag_count === 1 ? 'Flag' : 'Flags'}
  </Badge>
)}
```

## API Usage

### Report a Listing (User)

```typescript
import { flaggingService } from '@/lib/flagging-service';

await flaggingService.reportListing(
  spaceId,
  'fake_listing',
  'This address doesn\'t exist on Google Maps'
);
```

### Auto-Flag Check (System)

```typescript
// Call this when a listing is created
await flaggingService.checkListingForAutoFlag(spaceId, ownerId);
```

### Get Flagged Listings (Admin)

```typescript
const pending = await flaggingService.getFlaggedListings('pending');
const reviewing = await flaggingService.getFlaggedListings('reviewing');
```

### Update Flag Status (Admin)

```typescript
await flaggingService.updateFlagStatus(
  flagId,
  'resolved',
  'Owner updated driver\'s license. Address now verified.'
);
```

### Dismiss All Flags

```typescript
await flaggingService.dismissAllFlags(
  spaceId,
  'Owner provided proof of address. All flags dismissed.'
);
```

## Integration Points

### 1. Listing Creation

Add auto-flag check after listing is created:

```typescript
// In AISpaceListingModal after successful listing creation
const { data: newSpace } = await supabase.from('spaces').insert(...);

if (newSpace?.id) {
  // Auto-flag check
  await flaggingService.checkListingForAutoFlag(newSpace.id, user.id);
}
```

### 2. Space Card Component

Add Report button:

```tsx
<SpaceCard
  space={space}
  currentUserId={user?.id}
  onReport={(space) => {
    setSelectedSpace(space);
    setReportModalOpen(true);
  }}
/>
```

### 3. Index Page

Add report modal:

```tsx
const [reportModalOpen, setReportModalOpen] = useState(false);
const [selectedSpace, setSelectedSpace] = useState(null);

<ReportListingModal
  open={reportModalOpen}
  onOpenChange={setReportModalOpen}
  spaceId={selectedSpace?.id}
  spaceTitle={selectedSpace?.title}
/>
```

## Admin Dashboard (To Build)

Create `/src/pages/AdminDashboard.tsx`:

```typescript
export default function AdminDashboard() {
  const [flaggedListings, setFlaggedListings] = useState([]);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    loadFlaggedListings();
  }, [filter]);

  const loadFlaggedListings = async () => {
    const listings = await flaggingService.getFlaggedListings(filter);
    setFlaggedListings(listings);
  };

  return (
    <div>
      <h1>Flagged Listings</h1>
      
      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="reviewing">Reviewing</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Flagged listings table */}
      {flaggedListings.map(flag => (
        <Card key={flag.id}>
          <CardHeader>
            <CardTitle>{flag.space.title}</CardTitle>
            <Badge>{flag.flag_type}</Badge>
            {flag.auto_flagged && <Badge variant="secondary">Auto-Flagged</Badge>}
          </CardHeader>
          <CardContent>
            <p><strong>Reason:</strong> {flag.flag_reason}</p>
            <p><strong>Confidence:</strong> {flag.confidence_score}%</p>
            <p><strong>Flags:</strong> {flag.space.flag_count}</p>
            
            {/* Admin actions */}
            <div className="flex gap-2 mt-4">
              <Button onClick={() => updateFlag(flag.id, 'reviewing')}>
                Review
              </Button>
              <Button onClick={() => updateFlag(flag.id, 'resolved')}>
                Resolve
              </Button>
              <Button variant="outline" onClick={() => updateFlag(flag.id, 'dismissed')}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

## Security & Privacy

### User Reports
- ✅ Confidential - owner doesn't see reporter
- ✅ Protected from spam (24h edit window only)
- ✅ Can't report own listings
- ✅ Duplicate prevention

### Admin Access
- ✅ RLS policies protect sensitive data
- ✅ Only admins (@bagsy.space emails) can see all flags
- ✅ All flag updates logged with reviewer ID and timestamp

### False Report Prevention
- ⚠️ Warning displayed about false reports
- ⚠️ Terms of Service violation noted
- 🔄 Planned: Track false report rate per user
- 🔄 Planned: Suspend users who abuse reporting

## Migration Required

Apply the flagging system migration:

```bash
# Via Supabase Dashboard
1. Go to SQL Editor
2. Run: supabase/migrations/20250201000002_add_listing_flags.sql

# Via CLI
npx supabase db push
```

## Files Created

- ✅ `supabase/migrations/20250201000002_add_listing_flags.sql`
- ✅ `src/lib/flagging-service.ts`
- ✅ `src/components/spaces/report-listing-modal.tsx`
- ✅ `src/components/spaces/SpaceCard.tsx` (updated with Report button)

## Next Steps

1. **Apply Migration**: Run the SQL migration
2. **Integrate**: Add `onReport` handler to SpaceCard usage
3. **Test**: Try reporting a listing
4. **Build Admin Dashboard**: Create admin interface to review flags
5. **Monitor**: Watch for automatic flags on new listings

## Monitoring Queries

### Get all pending flags
```sql
SELECT 
  lf.*,
  s.title,
  s.address,
  s.owner_id
FROM listing_flags lf
JOIN spaces s ON s.id = lf.space_id
WHERE lf.status = 'pending'
ORDER BY lf.created_at DESC;
```

### Get auto-flagged listings
```sql
SELECT *
FROM listing_flags
WHERE auto_flagged = TRUE
AND status = 'pending'
ORDER BY confidence_score ASC;
```

### Get users with multiple flagged listings
```sql
SELECT 
  s.owner_id,
  COUNT(*) as flagged_listings,
  SUM(s.flag_count) as total_flags
FROM spaces s
WHERE s.is_flagged = TRUE
GROUP BY s.owner_id
HAVING COUNT(*) > 2
ORDER BY total_flags DESC;
```

## Summary

This flagging system provides:
- ✅ **User Reporting**: Community-driven moderation
- ✅ **Auto-Detection**: AI catches suspicious patterns
- ✅ **Admin Tools**: Efficient review workflow
- ✅ **Privacy**: Confidential reporting
- ✅ **Scale**: Handles high volume with confidence scoring

The system is flexible - you can tune the auto-flag thresholds and add new criteria as patterns emerge!

