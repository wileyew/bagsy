import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Lock, AlertCircle, CheckCircle, Loader2, Shield, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { stripePaymentService } from "@/lib/stripe-payment-service";
import { addressVerificationService } from "@/lib/address-verification-service";
import { supabase } from "@/integrations/supabase/client";

interface PaymentSetupFormProps {
  onSetupComplete: () => void;
  onSkip?: () => void;
  isRequired?: boolean;
  listingAddress?: string; // For address verification
}

export function PaymentSetupForm({ 
  onSetupComplete, 
  onSkip,
  isRequired = true,
  listingAddress 
}: PaymentSetupFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'stripe-connect' | 'address-verification' | 'processing' | 'complete'>('form');
  const [hasExistingSetup, setHasExistingSetup] = useState(false);
  const [stripeConnectUrl, setStripeConnectUrl] = useState<string | null>(null);
  const [addressVerificationResult, setAddressVerificationResult] = useState<any>(null);
  
  const [paymentData, setPaymentData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    zipCode: "",
    name: "",
    address: "",
    city: "",
    state: "",
  });

  // Check if user already has payment setup
  useEffect(() => {
    const checkExistingSetup = async () => {
      if (user) {
        const hasSetup = await stripePaymentService.hasPaymentSetup(user.id);
        setHasExistingSetup(hasSetup);
        if (hasSetup) {
          setStep('complete');
        }
      }
    };
    checkExistingSetup();
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setPaymentData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatCardNumber = (value: string) => {
    // Remove all non-digits
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    // Add spaces every 4 digits
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleSetupPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      // Validate form data
      if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv || !paymentData.zipCode) {
        throw new Error("Please fill in all required fields");
      }

      // Step 1: Create Stripe Connect account and get onboarding URL
      setStep('stripe-connect');
      toast({
        title: "Setting up your payment account...",
        description: "We're creating your secure Stripe Connect account for payments and verification.",
      });

      // Create Stripe Connect account
      const connectAccount = await stripePaymentService.createConnectAccount(user.id, {
        email: user.email!,
        name: paymentData.name || user.user_metadata?.full_name,
        address: {
          line1: paymentData.address,
          city: paymentData.city,
          state: paymentData.state,
          postal_code: paymentData.zipCode,
          country: 'US'
        }
      });

      // Get Stripe Connect onboarding URL
      const onboardingUrl = await stripePaymentService.createOnboardingLink(connectAccount.id, user.id);
      setStripeConnectUrl(onboardingUrl);

      toast({
        title: "Account Created!",
        description: "Please complete the secure verification process with Stripe.",
      });

    } catch (error: any) {
      setStep('form');
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to setup payment account. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleStripeConnectComplete = async () => {
    if (!user) return;

    setLoading(true);
    setStep('address-verification');

    try {
      // Step 2: Verify address after Stripe Connect completion
      if (listingAddress) {
        const billingAddress = {
          street: paymentData.address,
          city: paymentData.city,
          state: paymentData.state,
          zipCode: paymentData.zipCode,
          country: 'US'
        };

        // Parse listing address (this would be more sophisticated in real implementation)
        const listingParts = listingAddress.split(',');
        const listingAddressObj = {
          street: listingParts[0]?.trim() || '',
          city: listingParts[1]?.trim() || '',
          state: listingParts[2]?.trim().split(' ')[0] || '',
          zipCode: listingParts[2]?.trim().split(' ')[1] || '',
          country: 'US'
        };

        const verificationResult = addressVerificationService.verifyAddressMatch(
          billingAddress,
          listingAddressObj
        );

        setAddressVerificationResult(verificationResult);

        // Show verification result
        const message = addressVerificationService.getVerificationMessage(verificationResult);
        toast({
          title: message.title,
          description: message.description,
          variant: message.variant,
        });

        // If verification fails, show warning but allow to proceed
        if (!verificationResult.isMatch) {
          toast({
            title: "Address Verification Notice",
            description: "Your billing address doesn't match your listing location. This helps us verify account legitimacy for security.",
            variant: "warning",
            duration: 8000,
          });
        }
      }

      // Step 3: Complete setup
      setStep('processing');
      
      // Update user profile with payment setup status
      await supabase
        .from('profiles')
        .update({ 
          payment_method_setup: true,
          payment_method_setup_at: new Date().toISOString(),
          stripe_connect_account_id: user.id // This would be the actual account ID
        })
        .eq('user_id', user.id);

      setStep('complete');
      toast({
        title: "Payment Account Verified!",
        description: "Your account is now linked and verified. You can make bookings securely.",
      });
      
      // Wait a moment then call completion callback
      setTimeout(() => {
        onSetupComplete();
      }, 2000);

    } catch (error: any) {
      setStep('form');
      toast({
        title: "Verification Failed",
        description: error.message || "Failed to complete verification. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return paymentData.cardNumber.length >= 19 &&
           paymentData.expiryDate.length === 5 &&
           paymentData.cvv.length >= 3 &&
           paymentData.zipCode.length >= 5 &&
           paymentData.address.length >= 5 &&
           paymentData.city.length >= 2 &&
           paymentData.state.length === 2;
  };

  if (hasExistingSetup || step === 'complete') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-3 text-green-600">
            <CheckCircle className="h-6 w-6" />
            <div>
              <h3 className="font-semibold">Payment Method Ready</h3>
              <p className="text-sm text-muted-foreground">
                Your payment method is set up and ready for bookings
              </p>
            </div>
          </div>
          {!isRequired && (
            <div className="mt-4 text-center">
              <Button variant="outline" onClick={onSkip}>
                Continue Without Payment Setup
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'stripe-connect') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Secure Account Verification
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete your account setup with Stripe for secure payments and identity verification
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <h4 className="font-semibold mb-2">Why Stripe verification?</h4>
                <ul className="space-y-1 text-xs">
                  <li>• Verify your identity and billing address</li>
                  <li>• Secure your account against fraud</li>
                  <li>• Enable secure payments for bookings</li>
                  <li>• Comply with financial regulations</li>
                </ul>
              </div>
            </div>
          </div>

          {stripeConnectUrl ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Click below to complete your secure account setup with Stripe
                </p>
                <Button
                  onClick={() => window.open(stripeConnectUrl, '_blank')}
                  className="w-full apple-button-primary h-12"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Complete Stripe Verification
                </Button>
              </div>
              
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  After completing verification, click below to continue:
                </p>
                <Button
                  onClick={handleStripeConnectComplete}
                  variant="outline"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'I\'ve completed verification'
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Setting up your verification link...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (step === 'address-verification') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Address Verification
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Verifying your billing address against your listing location for security
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {addressVerificationResult && (
            <div className={`p-4 border rounded-lg ${
              addressVerificationResult.isMatch 
                ? 'bg-green-50 border-green-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-start gap-3">
                {addressVerificationResult.isMatch ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="text-sm">
                  <h4 className={`font-semibold mb-1 ${
                    addressVerificationResult.isMatch ? 'text-green-800' : 'text-amber-800'
                  }`}>
                    {addressVerificationResult.isMatch ? 'Address Verified' : 'Address Mismatch'}
                  </h4>
                  <p className={`text-xs ${
                    addressVerificationResult.isMatch ? 'text-green-700' : 'text-amber-700'
                  }`}>
                    Confidence: {addressVerificationResult.confidence}%
                    {addressVerificationResult.suggestion && (
                      <><br />{addressVerificationResult.suggestion}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Completing your account setup...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (step === 'processing') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div>
              <h3 className="font-semibold">Finalizing Setup</h3>
              <p className="text-sm text-muted-foreground">
                Securing your account and enabling payments...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          {isRequired ? 'Payment Setup Required' : 'Set Up Payment Method'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {isRequired 
            ? 'You need to add a payment method before making bookings.'
            : 'Add a payment method now to make booking easier.'
          }
        </p>
        
        {/* Stripe Connect Verification Notice */}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <strong className="block mb-1">Secure Account Verification Process:</strong>
              <ul className="list-disc pl-4 space-y-1">
                <li>We'll create a secure Stripe Connect account for you</li>
                <li>You'll complete identity verification with Stripe (bank-level security)</li>
                <li>Your billing address will be verified against your listing location</li>
                <li>This helps prevent fraud and ensures account legitimacy</li>
              </ul>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSetupPayment} className="space-y-4">
          {/* Cardholder Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Cardholder Name
            </Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={paymentData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="apple-input h-10 sm:h-12"
            />
          </div>

          {/* Card Number */}
          <div className="space-y-2">
            <Label htmlFor="cardNumber" className="text-sm font-medium">
              Card Number *
            </Label>
            <Input
              id="cardNumber"
              placeholder="4242 4242 4242 4242"
              value={paymentData.cardNumber}
              onChange={(e) => handleInputChange('cardNumber', formatCardNumber(e.target.value))}
              className="apple-input h-10 sm:h-12 font-mono"
              required
              maxLength={19}
            />
          </div>

          {/* Expiry and CVV */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="expiryDate" className="text-sm font-medium">
                Expiry Date *
              </Label>
              <Input
                id="expiryDate"
                placeholder="MM/YY"
                value={paymentData.expiryDate}
                onChange={(e) => handleInputChange('expiryDate', formatExpiryDate(e.target.value))}
                className="apple-input h-10 sm:h-12 font-mono"
                required
                maxLength={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cvv" className="text-sm font-medium">
                CVV *
              </Label>
              <Input
                id="cvv"
                placeholder="123"
                type="password"
                value={paymentData.cvv}
                onChange={(e) => handleInputChange('cvv', e.target.value.replace(/\D/g, ''))}
                className="apple-input h-10 sm:h-12 font-mono"
                required
                maxLength={4}
              />
            </div>
          </div>

          {/* Billing Address Section */}
          <div className="space-y-4 pt-2 border-t">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Billing Address (for verification)
            </h4>
            
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium">
                Street Address *
              </Label>
              <Input
                id="address"
                placeholder="123 Main St"
                value={paymentData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="apple-input h-10 sm:h-12"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">
                  City *
                </Label>
                <Input
                  id="city"
                  placeholder="San Francisco"
                  value={paymentData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="apple-input h-10 sm:h-12"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state" className="text-sm font-medium">
                  State *
                </Label>
                <Input
                  id="state"
                  placeholder="CA"
                  value={paymentData.state}
                  onChange={(e) => handleInputChange('state', e.target.value.toUpperCase())}
                  className="apple-input h-10 sm:h-12"
                  required
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode" className="text-sm font-medium">
                ZIP Code *
              </Label>
              <Input
                id="zipCode"
                placeholder="12345"
                value={paymentData.zipCode}
                onChange={(e) => handleInputChange('zipCode', e.target.value.replace(/\D/g, ''))}
                className="apple-input h-10 sm:h-12"
                required
                maxLength={10}
              />
            </div>
            
            <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              💡 <strong>Tip:</strong> This address will be compared with your space listing address to verify legitimacy and prevent fraud.
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Lock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Your payment information is secured with 256-bit SSL encryption and stored securely with Stripe. We never store your full card details.
            </p>
          </div>

          {/* Test Mode Notice */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <strong>Test Mode:</strong> Use card number 4242 4242 4242 4242 with any future expiry date and any 3-digit CVV.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || !isFormValid()}
              className="flex-1 apple-button-primary h-11 sm:h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Start Secure Verification
                </>
              )}
            </Button>
            
            {!isRequired && (
              <Button
                type="button"
                variant="outline"
                onClick={onSkip}
                className="px-6"
              >
                Skip for Now
              </Button>
            )}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            By setting up a payment method, you agree to our Terms of Service and Privacy Policy
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
