# Real ID Verification Implementation Guide

## Problem: Current System Doesn't Verify Document Authenticity

Our current implementation uses OCR to extract text from driver's licenses, but it **cannot detect**:
- ❌ Fake or forged documents
- ❌ Photoshopped images
- ❌ Expired or stolen IDs
- ❌ Impersonation (photo doesn't match user)

## Solution: Add Professional ID Verification

Use a specialized service that employs:
- ✅ **AI Document Authentication**: Detects tampering, forgeries, photoshop
- ✅ **Liveness Detection**: Video selfie to prevent photo spoofing
- ✅ **Government Database Checks**: Validates against official records
- ✅ **Biometric Face Matching**: Ensures photo matches user

---

## Recommended: Stripe Identity

### Why Stripe Identity?

1. **Already integrated** with your payment system
2. **Cost-effective**: $1.50 per verification
3. **High accuracy**: 99%+ fake detection rate
4. **Real-time**: Results in seconds
5. **Global support**: Works in 30+ countries
6. **Compliant**: SOC 2, GDPR, PCI-DSS

### Features

| Check | What It Does |
|-------|-------------|
| Document Authentication | Detects fake IDs, photoshops, tampering |
| Liveness Detection | Requires video selfie (prevents photo attacks) |
| Face Match | Compares selfie to ID photo |
| Expiration Check | Validates document hasn't expired |
| Data Extraction | OCR extraction of all fields |
| Database Validation | Checks against government databases |

---

## Implementation Steps

### 1. Install Dependencies

```bash
npm install stripe @stripe/stripe-js
```

### 2. Add Environment Variables

```bash
# .env.local
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx  # Backend only!
```

### 3. Create Backend API Endpoints

You'll need a backend API (Node.js, Python, etc.) to handle Stripe requests:

#### Option A: Supabase Edge Function

```typescript
// supabase/functions/stripe-identity/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const { action, userId, sessionId } = await req.json()

  if (action === 'create') {
    // Create verification session
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { userId },
      options: {
        document: {
          allowed_types: ['driving_license'],
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      return_url: `${req.headers.get('origin')}/verification-complete`,
    })

    return new Response(
      JSON.stringify({
        clientSecret: session.client_secret,
        sessionId: session.id,
        url: session.url,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (action === 'check') {
    // Check verification status
    const session = await stripe.identity.verificationSessions.retrieve(sessionId)
    
    return new Response(
      JSON.stringify({
        verified: session.status === 'verified',
        status: session.status,
        document: session.verified_outputs,
        checks: session.last_verification_report,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  return new Response('Invalid action', { status: 400 })
})
```

Deploy:
```bash
supabase functions deploy stripe-identity
```

#### Option B: Express.js Backend

```javascript
// backend/routes/stripe-identity.js
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/create-session', async (req, res) => {
  const { userId } = req.body;

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { userId },
    options: {
      document: {
        allowed_types: ['driving_license', 'passport', 'id_card'],
        require_live_capture: true,
        require_matching_selfie: true,
      },
    },
    return_url: `${process.env.FRONTEND_URL}/verification-complete`,
  });

  res.json({
    clientSecret: session.client_secret,
    sessionId: session.id,
    url: session.url,
  });
});

router.get('/check-status/:sessionId', async (req, res) => {
  const session = await stripe.identity.verificationSessions.retrieve(
    req.params.sessionId
  );

  res.json({
    verified: session.status === 'verified',
    status: session.status,
    document: session.verified_outputs,
    checks: session.last_verification_report,
  });
});

module.exports = router;
```

### 4. Update Driver License Upload Component

```typescript
// src/components/auth/driver-license-upload.tsx
import { stripeIdentityService } from '@/lib/stripe-identity-service';

// Add a button for Stripe verification
const handleStripeVerification = async () => {
  setUploading(true);
  try {
    const { verificationUrl, sessionId } = await stripeIdentityService.verifyUserIdentity(user.id);
    
    // Save session ID for later
    sessionStorage.setItem('stripe_verification_session', sessionId);
    
    // Redirect user to Stripe's hosted verification page
    window.location.href = verificationUrl;
  } catch (error) {
    toast({
      title: "Verification Failed",
      description: "Could not start ID verification. Please try again.",
      variant: "destructive",
    });
  } finally {
    setUploading(false);
  }
};

// Add button in your component:
<Button
  onClick={handleStripeVerification}
  className="w-full apple-button-primary h-12 font-semibold"
>
  <ShieldCheck className="h-4 w-4 mr-2" />
  Verify with Stripe Identity ($1.50)
</Button>
```

### 5. Handle Verification Callback

```typescript
// src/pages/VerificationComplete.tsx
import { useEffect } from 'react';
import { stripeIdentityService } from '@/lib/stripe-identity-service';
import { useAuthContext } from '@/contexts/auth-context';
import { useNavigate } from 'react-router-dom';

export default function VerificationComplete() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    const handleVerification = async () => {
      const sessionId = sessionStorage.getItem('stripe_verification_session');
      if (!sessionId) return;

      // Check verification status
      const result = await stripeIdentityService.checkVerificationStatus(sessionId);
      
      if (result && result.verified) {
        // Store results in database
        await stripeIdentityService.storeVerificationResult(user.id, result);
        
        // Show success and redirect
        toast({
          title: "✅ Identity Verified!",
          description: "Your driver's license has been verified successfully.",
        });
        
        navigate('/list-space');
      } else {
        toast({
          title: "Verification Failed",
          description: result?.status === 'requires_input' 
            ? "Additional information needed. Please try again."
            : "Verification could not be completed.",
          variant: "destructive",
        });
        
        navigate('/');
      }

      // Clean up
      sessionStorage.removeItem('stripe_verification_session');
    };

    handleVerification();
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingDots size="lg" />
      <p>Processing verification...</p>
    </div>
  );
}
```

---

## Alternative: Hybrid Approach (Recommended for MVP)

Start with our current OCR system, then add Stripe for high-risk listings:

### Tiered Verification System

| User Action | Verification Level | Cost |
|-------------|-------------------|------|
| First listing | OCR + Address Match | Free |
| High-value listing (>$100/day) | **Stripe Identity** | $1.50 |
| Multiple flagged listings | **Stripe Identity** | $1.50 |
| User requests badge | **Stripe Identity** | $1.50 |

### Implementation

```typescript
// Determine if Stripe verification is needed
const needsStripeVerification = (user, listing) => {
  // High value listing
  if (listing.pricePerDay > 100) return true;
  
  // User has been flagged before
  if (user.flaggedListingsCount > 2) return true;
  
  // Address verification failed multiple times
  if (user.addressVerificationFailures > 1) return true;
  
  // User wants "Verified" badge
  if (user.wantsVerifiedBadge) return true;
  
  return false;
};
```

---

## Cost Comparison

| Service | Cost/Verification | Fake Detection | Liveness | Global |
|---------|------------------|----------------|----------|--------|
| **Stripe Identity** | $1.50 | ✅ Yes | ✅ Yes | 30+ countries |
| Current (OCR only) | ~$0.01 | ❌ No | ❌ No | Worldwide |
| Veriff | $2.00-3.00 | ✅ Yes | ✅ Yes | 190+ countries |
| Onfido | $1.00-2.00 | ✅ Yes | ✅ Yes | 195 countries |
| Persona | $1.25 | ✅ Yes | ✅ Yes | Global |

---

## Fake ID Detection Features

### What Stripe Identity Checks

1. **Document Features**
   - Holographic overlays
   - Microprinting
   - UV patterns
   - Barcode validation
   - MRZ (Machine Readable Zone)

2. **Image Analysis**
   - Copy-paste detection
   - Photoshop artifacts
   - Consistency checks
   - Resolution analysis
   - Lighting patterns

3. **Behavioral Signals**
   - Upload timing patterns
   - Device fingerprinting
   - Geolocation matching

4. **Liveness Detection**
   - Face movement (blink, smile)
   - 3D depth analysis
   - Video quality checks
   - Anti-replay protection

---

## Migration Path

### Phase 1: Current (Free, Low Security)
- ✅ OCR extraction
- ✅ Address matching
- ❌ No fake detection

### Phase 2: Add Stripe (Pay-per-use, High Security)
- ✅ Everything from Phase 1
- ✅ Fake ID detection
- ✅ Liveness check
- ✅ Verified badge

### Phase 3: Hybrid (Smart, Cost-Effective)
- Free OCR for most users
- Stripe only for:
  - High-value listings
  - Suspicious patterns
  - User-requested verification

---

## Testing

### Stripe Test Mode

Use test documents in Stripe test mode:

```javascript
// Test document that passes all checks
const testPassingDoc = {
  number: '000000000',
  country: 'US',
  type: 'driving_license'
};

// Test document that fails authenticity
const testFailingDoc = {
  number: '111111111',
  country: 'US',
  type: 'driving_license'
};
```

---

## Conclusion

**Recommendation for Bagsy:**

1. **Short-term (MVP)**: Keep current OCR + address matching (free)
2. **Medium-term**: Add Stripe Identity for high-risk scenarios ($1.50/use)
3. **Long-term**: Make Stripe Identity mandatory for all listings, offer "Verified" badge

This balances security with cost while building trust in your platform.

