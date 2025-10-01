# Driver's License Address Verification Guide

## Overview

We've implemented **automatic address verification** that uses AI (OpenAI Vision) to extract information from driver's licenses and verify that the listing address matches the license address.

## How It Works

### 1. License Upload
- User uploads their driver's license during the first listing attempt
- License is stored securely in the `driver-licenses` bucket

### 2. OCR Extraction (First Time Only)
- When user enters a listing address, the system automatically:
  - Uses OpenAI GPT-4 Vision to extract text from the license
  - Parses out: address, city, state, ZIP code, name, expiration date
  - Stores this information in the `profiles` table

### 3. Address Verification
- Compares the extracted license address with the listing address
- Generates a confidence score (0-100%)
- Shows verification status to the user in real-time

### 4. Verification Statuses

| Status | Confidence | Meaning |
|--------|-----------|---------|
| ✅ **Verified** | ≥90% | Address matches perfectly - auto-approved |
| ⚠️ **Needs Review** | 50-89% | Partial match - may need manual review |
| ❌ **Failed** | <50% | No match or expired license - requires review |

## User Experience

### Visual Indicators

When a user enters their listing address:

1. **Loading State**: Shows a spinner while verifying
2. **Match (Green)**: ✅ checkmark icon + "Address Verified" message
3. **Mismatch (Yellow)**: ⚠️ warning icon + explanation of the mismatch

### Example Flow

```
User: [Enters "123 Main St"]
System: [Extracts license address: "123 Main Street, San Francisco, CA 94110"]
Result: ✅ Address Verified (95% confidence)
Message: "This address matches your driver's license"
```

```
User: [Enters "456 Oak Ave"]
System: [License address: "123 Main Street"]
Result: ⚠️ Address Mismatch
Message: "The listing address doesn't match your driver's license. 
         License Address: 123 Main Street, San Francisco, CA
         You can still proceed, but verification may be required."
```

## Database Fields Added

The migration adds these fields to the `profiles` table:

```sql
driver_license_extracted_address TEXT    -- Full address from license
driver_license_extracted_name TEXT        -- Name from license
driver_license_expiration_date TEXT       -- Expiration date
driver_license_verification_confidence INT -- Score 0-100
driver_license_verification_notes TEXT    -- AI or manual notes
```

## API Usage

### License Verification Service

```typescript
import { licenseVerificationService } from '@/lib/license-verification-service';

// Extract info from license
const extracted = await licenseVerificationService.extractLicenseInfo(imageUrl);

// Verify address match
const verification = await licenseVerificationService.verifyAddress(
  extracted,
  listingAddress,
  listingZipCode
);

// Complete workflow
const result = await licenseVerificationService.verifyLicense(
  imageUrl,
  listingAddress,
  listingZipCode
);
```

### Response Structure

```typescript
{
  extracted: {
    address: "123 Main Street",
    city: "San Francisco",
    state: "CA",
    zipCode: "94110",
    fullAddress: "123 Main Street, San Francisco, CA 94110",
    name: "John Doe",
    licenseNumber: "D1234567",
    expirationDate: "2026-12-31",
    confidence: "high"
  },
  verification: {
    isMatch: true,
    confidence: 95,
    extractedAddress: "123 Main Street, San Francisco, CA 94110",
    providedAddress: "123 Main St",
    matchDetails: {
      streetMatch: true,
      cityMatch: true,
      stateMatch: true,
      zipMatch: true
    },
    warnings: [],
    suggestions: []
  },
  isExpired: false,
  overallStatus: "verified"
}
```

## Configuration

### OpenAI Setup
- Uses `gpt-4o-mini` model for cost efficiency
- Can upgrade to `gpt-4o` for better accuracy
- Requires `VITE_OPENAI_API_KEY` environment variable

### Cost Estimation
- **GPT-4o-mini**: ~$0.01 per verification (first time only)
- **GPT-4o**: ~$0.05 per verification (first time only)
- Subsequent checks use cached data (free)

### Rate Limiting
The system implements smart caching:
- First address entry: Extracts data via API ($)
- Subsequent addresses: Uses cached extraction (free)
- Only calls API once per user's license

## Address Matching Logic

The system uses a multi-component matching algorithm:

### Normalization
```typescript
// Both addresses normalized to lowercase, no punctuation
"123 Main St." → "123 main st"
"123 Main Street" → "123 main street"
```

### Component Matching
1. **Street Match**: Compares street number and name
2. **City Match**: Compares city names
3. **State Match**: Compares state abbreviations
4. **ZIP Match**: Compares ZIP codes

### Confidence Calculation
```typescript
confidence = (matchedComponents / totalComponents) * 100

// Example:
// 3 out of 4 components match = 75% confidence
```

## Security & Privacy

### Data Storage
- License images stored in encrypted Supabase Storage
- User-specific folders: `{user_id}/driver-license-*.jpg`
- RLS policies ensure users can only access their own data

### Data Extraction
- OCR extraction happens server-side via OpenAI API
- No license data sent to third parties (except OpenAI for OCR)
- Extracted text stored in database (not the image itself for matching)

### User Control
- Users can delete their license anytime
- Can re-upload if verification fails
- Not blocked from listing if verification fails (just flagged for review)

## Admin Features

### Manual Review Dashboard (Future)
Build an admin interface to:
1. View listings with verification status < 90%
2. See extracted address vs listing address side-by-side
3. View the actual license image
4. Manually approve/reject
5. Add notes to `driver_license_verification_notes`

### Sample Query
```sql
-- Get all listings needing manual review
SELECT 
  p.user_id,
  p.driver_license_extracted_address,
  p.driver_license_verification_confidence,
  s.address as listing_address,
  s.title
FROM profiles p
JOIN spaces s ON s.owner_id = p.user_id
WHERE p.driver_license_verification_confidence < 90
  AND p.driver_license_verification_confidence > 0
ORDER BY p.driver_license_verification_confidence ASC;
```

## Troubleshooting

### Common Issues

**Problem**: "Could not extract address from license"
- **Cause**: Poor image quality, glare, or non-standard license format
- **Solution**: Ask user to upload a clearer photo

**Problem**: Address mismatch even though it's correct
- **Cause**: Street abbreviations (St vs Street, Rd vs Road)
- **Solution**: System normalizes common abbreviations, but may need manual review

**Problem**: Expired license detected
- **Cause**: License expiration date has passed
- **Solution**: User must update their license before listing

### Testing

```bash
# Test the verification service
npm run test:verification

# Or manually test with:
curl -X POST http://localhost:8080/api/verify-license \
  -H "Content-Type: application/json" \
  -d '{
    "imageUrl": "https://...",
    "address": "123 Main St",
    "zipCode": "94110"
  }'
```

## Future Enhancements

1. **Multi-License Support**: Allow users to verify multiple properties
2. **Address History**: Track if user moves and updates license
3. **International Support**: Support non-US licenses and addresses
4. **Real-time Validation**: Verify during upload (not just address entry)
5. **Confidence Thresholds**: Admin-configurable confidence levels
6. **Appeal Process**: Let users dispute mismatches
7. **Document Types**: Support other ID types (passport, state ID)

## Migration Required

Don't forget to apply the updated migration:

```bash
# Via Supabase Dashboard
1. Go to SQL Editor
2. Run: supabase/migrations/20250201000001_add_driver_license_verification.sql

# Or via CLI
npx supabase db push
```

## Summary

This feature adds **automated trust and safety** to your platform by:
- ✅ Verifying users are who they say they are
- ✅ Ensuring listings are at legitimate addresses
- ✅ Reducing fraud and scams
- ✅ Providing a seamless user experience
- ✅ Using AI to automate manual verification work

The system is **flexible** - users can still list even if verification fails, but admins can review flagged listings for safety.

