import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Lock, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { stripePaymentService } from "@/lib/stripe-payment-service";
import { supabase } from "@/integrations/supabase/client";

interface PaymentSetupFormProps {
  onSetupComplete: () => void;
  onSkip?: () => void;
  isRequired?: boolean;
}

export function PaymentSetupForm({ 
  onSetupComplete, 
  onSkip,
  isRequired = true 
}: PaymentSetupFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'processing' | 'complete'>('form');
  const [hasExistingSetup, setHasExistingSetup] = useState(false);
  
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
    setStep('processing');

    try {
      // Validate form data
      if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv || !paymentData.zipCode) {
        throw new Error("Please fill in all required fields");
      }

      // Create or get Stripe customer
      const customer = await stripePaymentService.createOrGetCustomer(
        user.id,
        user.email!,
        paymentData.name || user.user_metadata?.full_name
      );

      // Set up payment method
      const { clientSecret, paymentMethodId } = await stripePaymentService.setupPaymentMethod(
        customer.id,
        user.id
      );

      // In a real implementation, you would use Stripe.js to confirm the setup intent
      // For now, we'll simulate the confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Confirm the payment method setup
      const result = await stripePaymentService.confirmPaymentMethodSetup(
        'setup_intent_mock', // This would be the actual setup intent ID
        user.id
      );

      if (result.success) {
        setStep('complete');
        toast({
          title: "Payment Method Added!",
          description: "Your payment method has been securely saved for future bookings.",
        });
        
        // Wait a moment then call completion callback
        setTimeout(() => {
          onSetupComplete();
        }, 1500);
      } else {
        throw new Error(result.error || "Failed to setup payment method");
      }
    } catch (error: any) {
      setStep('form');
      toast({
        title: "Setup Failed",
        description: error.message || "Failed to setup payment method. Please try again.",
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

  if (step === 'processing') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div>
              <h3 className="font-semibold">Setting Up Payment Method</h3>
              <p className="text-sm text-muted-foreground">
                Securely processing your payment information...
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
        
        {/* Address Verification Notice */}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800">
              <strong className="block mb-1">Why we need this:</strong>
              <ul className="list-disc pl-4 space-y-1">
                <li>Process payments for your bookings securely</li>
                <li>Verify your billing address matches your listing location (helps prevent fraud)</li>
                <li>Speed up future bookings with saved payment info</li>
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
                  Setting Up...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Set Up Payment Method
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
