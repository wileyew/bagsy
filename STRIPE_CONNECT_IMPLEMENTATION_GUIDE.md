# Stripe Connect Implementation Guide

## Overview

This guide provides the complete implementation for the Stripe Connect integration that enables secure account verification and payment processing. The system now includes:

1. **Stripe Connect Account Creation** - Creates secure accounts for users
2. **Identity Verification** - Stripe handles bank-level identity verification
3. **Address Verification** - Compares billing addresses with listing locations
4. **User Feedback** - Clear indication of verification progress and status

## Frontend Changes Made

### 1. Enhanced Payment Setup Form (`src/components/payments/payment-setup-form.tsx`)

**New Features:**
- Multi-step verification process with clear user feedback
- Stripe Connect onboarding integration
- Address verification against listing location
- Enhanced security messaging and explanations

**New Steps:**
1. **Form Step** - Collect payment information and billing address
2. **Stripe Connect Step** - Redirect to Stripe for identity verification
3. **Address Verification Step** - Verify billing address matches listing location
4. **Processing Step** - Complete account setup
5. **Complete Step** - Success confirmation

### 2. Updated Payment Setup Modal (`src/components/payments/payment-setup-modal.tsx`)

**New Features:**
- Added `listingAddress` prop for address verification
- Passes listing address to form for verification

### 3. Enhanced Stripe Payment Service (`src/lib/stripe-payment-service.ts`)

**New Methods:**
- `createConnectAccount()` - Creates Stripe Connect Express accounts
- `createOnboardingLink()` - Generates secure onboarding URLs
- `checkConnectAccountStatus()` - Verifies account completion status

### 4. Database Schema Updates

**New Migration:** `supabase/migrations/20250201000003_add_stripe_connect_fields.sql`

**New Fields in `profiles` table:**
- `stripe_connect_account_id` - Stores Stripe Connect account ID
- `stripe_connect_onboarding_completed` - Tracks onboarding completion
- `stripe_connect_onboarding_completed_at` - Timestamp of completion

## Backend API Implementation Required

You need to implement these API endpoints in your backend:

### 1. Create Stripe Connect Account

**Endpoint:** `POST /api/stripe-payments/create-connect-account`

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.post('/api/stripe-payments/create-connect-account', async (req, res) => {
  try {
    const { userId, email, name, address, type, capabilities, business_type } = req.body;

    const account = await stripe.accounts.create({
      type: type || 'express',
      country: 'US',
      email,
      capabilities: capabilities || ['card_payments', 'transfers'],
      business_type: business_type || 'individual',
      individual: {
        email,
        first_name: name?.split(' ')[0],
        last_name: name?.split(' ').slice(1).join(' '),
        address: address ? {
          line1: address.line1,
          city: address.city,
          state: address.state,
          postal_code: address.postal_code,
          country: address.country || 'US'
        } : undefined
      }
    });

    res.json({ id: account.id });
  } catch (error) {
    console.error('Error creating Connect account:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 2. Create Onboarding Link

**Endpoint:** `POST /api/stripe-payments/create-onboarding-link`

```javascript
app.post('/api/stripe-payments/create-onboarding-link', async (req, res) => {
  try {
    const { accountId, userId, refresh_url, return_url } = req.body;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url,
      return_url,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (error) {
    console.error('Error creating onboarding link:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 3. Check Connect Account Status

**Endpoint:** `GET /api/stripe-payments/check-connect-status/:accountId`

```javascript
app.get('/api/stripe-payments/check-connect-status/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await stripe.accounts.retrieve(accountId);

    res.json({
      charges_enabled: account.charges_enabled,
      details_submitted: account.details_submitted,
      payouts_enabled: account.payouts_enabled,
      requirements: account.requirements
    });
  } catch (error) {
    console.error('Error checking account status:', error);
    res.status(500).json({ error: error.message });
  }
});
```

## User Flow

### 1. Payment Setup Process

```
User clicks "Set Up Payment Method"
    ↓
Fill out payment form (card + billing address)
    ↓
Click "Start Secure Verification"
    ↓
System creates Stripe Connect account
    ↓
Redirect to Stripe onboarding (new tab)
    ↓
User completes Stripe verification
    ↓
User clicks "I've completed verification"
    ↓
System verifies billing address against listing location
    ↓
Show verification results with confidence score
    ↓
Complete account setup
    ↓
Success message and redirect
```

### 2. Address Verification Logic

The system compares:
- **Billing Address** (from payment form)
- **Listing Address** (from space listing)

**Scoring System:**
- ZIP Code match: 40 points
- State match: 20 points  
- City match: 20 points (85% similarity allowed)
- Street match: 20 points (80% similarity allowed)

**Thresholds:**
- 80-100%: ✅ Verified
- 60-79%: ⚠️ Partial Match
- 0-59%: ❌ Mismatch (requires review)

### 3. User Feedback

**During Stripe Verification:**
- Clear explanation of why Stripe verification is needed
- Security benefits highlighted
- Step-by-step progress indication

**After Address Verification:**
- Confidence score display
- Match/mismatch status
- Helpful suggestions for mismatches
- Security explanation for verification process

## Security Benefits

### What This Prevents:
- ✅ Casual fake listings (requires real payment method)
- ✅ Listings from obviously wrong locations
- ✅ Users without valid payment methods
- ✅ Some identity theft (bank-level verification)

### Additional Security:
- Real payment method verification via Stripe
- Bank-level identity verification
- Address consistency checking
- Fraud pattern detection capability

## Integration Points

### 1. Booking Flow
When users try to book a space:
```typescript
// Check if payment setup is complete
const hasPayment = await stripePaymentService.hasPaymentSetup(user.id);
if (!hasPayment) {
  // Show PaymentSetupModal with listing address
  setPaymentSetupOpen(true);
}
```

### 2. Listing Creation Flow
When users create listings:
```typescript
// Pass listing address for verification
<PaymentSetupModal
  listingAddress={listingData.address}
  onSetupComplete={handlePaymentComplete}
/>
```

## Environment Variables Required

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Frontend
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Testing

### Test Cards (Stripe Test Mode)
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Insufficient Funds:** 4000 0000 0000 9995

### Test Scenarios
1. **Exact Address Match** - Same ZIP, city, state, street
2. **Partial Match** - Same city/state, different ZIP
3. **Complete Mismatch** - Different states
4. **Stripe Verification** - Complete onboarding flow

## Deployment Checklist

- [ ] Run database migration: `20250201000003_add_stripe_connect_fields.sql`
- [ ] Set up Stripe Connect in Stripe Dashboard
- [ ] Configure webhook endpoints for Connect events
- [ ] Deploy backend API endpoints
- [ ] Set environment variables
- [ ] Test complete flow in staging
- [ ] Update production Stripe keys

## Monitoring

Track these metrics:
- Stripe Connect onboarding completion rate
- Address verification success rate
- Payment setup abandonment rate
- Fraud incidents (false positives/negatives)

## Support

For issues:
1. Check Stripe Dashboard for Connect account status
2. Review address verification logs
3. Monitor API endpoint responses
4. Check user profile payment setup status

This implementation provides bank-level security while maintaining a smooth user experience and clear feedback throughout the verification process.
