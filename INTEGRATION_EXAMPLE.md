# Integration Example: Payment Setup in Booking Flow

## How to Integrate Payment Setup into Your Existing Code

### 1. Update Booking Flow

```tsx
// src/pages/BookingPage.tsx or similar
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { stripePaymentService } from '@/lib/stripe-payment-service';
import { PaymentSetupModal } from '@/components/payments/payment-setup-modal';
import { PaymentForm } from '@/components/bookings/payment-form';

export function BookingPage({ booking }: { booking: any }) {
  const { user } = useAuth();
  const [hasPaymentSetup, setHasPaymentSetup] = useState(false);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check if user has payment setup on load
  useEffect(() => {
    const checkPaymentSetup = async () => {
      if (user) {
        const hasSetup = await stripePaymentService.hasPaymentSetup(user.id);
        setHasPaymentSetup(hasSetup);
        
        // If no setup, show the modal
        if (!hasSetup) {
          setShowPaymentSetup(true);
        }
      }
      setCheckingSetup(false);
    };

    checkPaymentSetup();
  }, [user]);

  const handleSetupComplete = () => {
    setHasPaymentSetup(true);
    setShowPaymentSetup(false);
  };

  if (checkingSetup) {
    return <div>Checking payment setup...</div>;
  }

  return (
    <div>
      {/* Show payment setup modal if needed */}
      <PaymentSetupModal
        open={showPaymentSetup}
        onOpenChange={setShowPaymentSetup}
        onSetupComplete={handleSetupComplete}
        isRequired={true}
        title="Complete Payment Setup"
        description="Before booking, we need to set up your payment method and verify your billing address."
      />

      {/* Show booking payment form only after setup */}
      {hasPaymentSetup ? (
        <PaymentForm
          booking={booking}
          onPaymentComplete={() => {
            // Handle booking completion
          }}
        />
      ) : (
        <div className="p-4 text-center">
          <p>Please complete payment setup to continue</p>
          <button onClick={() => setShowPaymentSetup(true)}>
            Set Up Payment
          </button>
        </div>
      )}
    </div>
  );
}
```

### 2. Update Space Listing Flow with Address Verification

```tsx
// src/pages/ListSpacePage.tsx or similar
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { stripePaymentService } from '@/lib/stripe-payment-service';
import { addressVerificationService } from '@/lib/address-verification-service';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PaymentSetupModal } from '@/components/payments/payment-setup-modal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle } from 'lucide-react';

export function ListSpacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const handleSubmitListing = async (listingData: any) => {
    if (!user) return;

    // Check if user has payment setup
    const hasPayment = await stripePaymentService.hasPaymentSetup(user.id);
    
    if (!hasPayment) {
      // Show payment setup modal
      setShowPaymentSetup(true);
      toast({
        title: "Payment Setup Required",
        description: "We need to verify your billing address matches your listing location.",
      });
      return;
    }

    // Get user's profile with payment info
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile || !profile.stripe_customer_id) {
      toast({
        title: "Error",
        description: "Could not verify payment information",
        variant: "destructive",
      });
      return;
    }

    // Get billing address from Stripe (you'd implement this)
    // For now, assume we have it stored or can retrieve it
    const billingAddress = {
      street: '123 Main St', // Get from Stripe
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
    };

    const listingAddress = {
      street: listingData.address,
      city: listingData.city || 'San Francisco',
      state: listingData.state || 'CA',
      zipCode: listingData.zip_code,
    };

    // Verify address match
    const result = addressVerificationService.verifyAddressMatch(
      billingAddress,
      listingAddress
    );

    setVerificationResult(result);

    if (result.confidence >= 80) {
      // High confidence - proceed with listing
      await createListing(listingData);
      
      toast({
        title: "✓ Listing Created",
        description: "Your space has been listed successfully!",
      });
    } else if (result.confidence >= 60) {
      // Partial match - warn but allow
      toast({
        title: "⚠ Partial Address Match",
        description: result.suggestion || "Your addresses are similar but not identical. Your listing will be reviewed.",
        variant: "default",
      });
      
      await createListing(listingData, { needsReview: true });
    } else {
      // No match - require additional verification
      toast({
        title: "✗ Address Mismatch",
        description: "Your billing address doesn't match your listing location. Consider adding ID verification.",
        variant: "destructive",
      });
    }
  };

  const createListing = async (listingData: any, options = {}) => {
    const { data, error } = await supabase
      .from('spaces')
      .insert([{
        ...listingData,
        owner_id: user!.id,
        is_active: options.needsReview ? false : true,
      }]);

    if (error) throw error;
    return data;
  };

  return (
    <div>
      <PaymentSetupModal
        open={showPaymentSetup}
        onOpenChange={setShowPaymentSetup}
        onSetupComplete={() => {
          setShowPaymentSetup(false);
          toast({
            title: "Payment Setup Complete",
            description: "You can now continue listing your space.",
          });
        }}
        isRequired={false}
        title="Verify Your Address"
        description="Add your payment method to verify your billing address matches your listing location."
      />

      {/* Show verification result */}
      {verificationResult && (
        <Alert variant={verificationResult.confidence >= 80 ? "default" : "destructive"}>
          {verificationResult.confidence >= 80 ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertDescription>
            <strong>Address Verification: {verificationResult.confidence}% match</strong>
            <p className="text-sm mt-1">{verificationResult.suggestion}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Your existing listing form */}
      <form onSubmit={handleSubmitListing}>
        {/* ... */}
      </form>
    </div>
  );
}
```

### 3. Update User Profile/Dashboard

```tsx
// src/pages/ProfilePage.tsx or similar
import { useAuth } from '@/hooks/use-auth';
import { stripePaymentService } from '@/lib/stripe-payment-service';
import { PaymentSetupModal } from '@/components/payments/payment-setup-modal';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CheckCircle, CreditCard, XCircle } from 'lucide-react';

export function ProfilePage() {
  const { user } = useAuth();
  const [hasPaymentSetup, setHasPaymentSetup] = useState(false);
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSetup = async () => {
      if (user) {
        const hasSetup = await stripePaymentService.hasPaymentSetup(user.id);
        setHasPaymentSetup(hasSetup);
      }
      setLoading(false);
    };
    checkSetup();
  }, [user]);

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Checking payment setup...</p>
          ) : hasPaymentSetup ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Payment method on file</p>
                <p className="text-sm text-muted-foreground">
                  Your payment method is set up and ready for bookings
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                <XCircle className="h-5 w-5" />
                <p className="font-medium">No payment method</p>
              </div>
              <Button onClick={() => setShowPaymentSetup(true)}>
                Add Payment Method
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <PaymentSetupModal
        open={showPaymentSetup}
        onOpenChange={setShowPaymentSetup}
        onSetupComplete={() => {
          setHasPaymentSetup(true);
          setShowPaymentSetup(false);
        }}
        isRequired={false}
      />
    </div>
  );
}
```

### 4. Simple Hook for Payment Check

```tsx
// src/hooks/use-payment-setup.ts
import { useState, useEffect } from 'react';
import { useAuth } from './use-auth';
import { stripePaymentService } from '@/lib/stripe-payment-service';

export function usePaymentSetup() {
  const { user } = useAuth();
  const [hasPaymentSetup, setHasPaymentSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPaymentSetup = async () => {
      if (user) {
        const hasSetup = await stripePaymentService.hasPaymentSetup(user.id);
        setHasPaymentSetup(hasSetup);
      }
      setLoading(false);
    };

    checkPaymentSetup();
  }, [user]);

  const refreshPaymentSetup = async () => {
    if (user) {
      const hasSetup = await stripePaymentService.hasPaymentSetup(user.id);
      setHasPaymentSetup(hasSetup);
    }
  };

  return {
    hasPaymentSetup,
    loading,
    refreshPaymentSetup,
  };
}
```

Then use it anywhere:

```tsx
import { usePaymentSetup } from '@/hooks/use-payment-setup';

function MyComponent() {
  const { hasPaymentSetup, loading } = usePaymentSetup();

  if (loading) return <div>Loading...</div>;
  
  if (!hasPaymentSetup) {
    return <div>Please set up payment method first</div>;
  }

  return <div>Ready to book!</div>;
}
```

### 5. Protect Routes

```tsx
// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { usePaymentSetup } from '@/hooks/use-payment-setup';

export function PaymentProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { hasPaymentSetup, loading: paymentLoading } = usePaymentSetup();

  if (authLoading || paymentLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!hasPaymentSetup) {
    return <Navigate to="/setup-payment" />;
  }

  return <>{children}</>;
}
```

## Quick Start Checklist

- [ ] Run database migration
- [ ] Set up backend API endpoints
- [ ] Add environment variables
- [ ] Import `PaymentSetupModal` in booking flow
- [ ] Add payment check before bookings
- [ ] Add address verification to listing creation
- [ ] Update user profile to show payment status
- [ ] Test with Stripe test cards
- [ ] Monitor verification success rates

## Testing Scenarios

### Test Case 1: New User First Booking
1. User signs up
2. Finds a space to book
3. Clicks "Book Now"
4. Sees payment setup modal
5. Enters card + billing address
6. System verifies address
7. Proceeds to booking confirmation

### Test Case 2: Existing User Adding Listing
1. User has payment method
2. Clicks "List Space"
3. Enters space details
4. System checks billing address
5. If match: Instant approval
6. If no match: Suggests ID verification

### Test Case 3: User Profile Check
1. User goes to profile
2. Sees "Payment Method" section
3. Shows green checkmark if set up
4. Shows "Add Payment" button if not
5. Clicking button opens modal
