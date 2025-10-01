import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, Lock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/lib/notification-service";

interface PaymentFormProps {
  booking: any;
  onPaymentComplete: () => void;
}

export function PaymentForm({ booking, onPaymentComplete }: PaymentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [licensePlate, setLicensePlate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    zipCode: "",
  });

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate license plate
      if (!licensePlate || licensePlate.length < 2) {
        throw new Error("Please enter a valid license plate number");
      }

      // Mock Stripe payment processing (in production, use Stripe.js)
      // This would normally create a PaymentIntent and process the payment
      const mockPaymentIntentId = `pi_mock_${Date.now()}`;
      
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update booking with payment information
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          license_plate: licensePlate.toUpperCase(),
          payment_intent_id: mockPaymentIntentId,
          payment_status: 'succeeded',
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      // Notify owner of payment
      await notificationService.notifyPaymentReceived(
        booking.owner_id,
        booking.id,
        booking.total_price,
        'Renter'
      );

      // Notify both parties of confirmation
      await notificationService.notifyBookingConfirmed(
        booking.renter_id,
        booking.id,
        booking.spaces?.title || 'Space',
        booking.start_time,
        booking.end_time
      );

      await notificationService.notifyBookingConfirmed(
        booking.owner_id,
        booking.id,
        booking.spaces?.title || 'Space',
        booking.start_time,
        booking.end_time
      );

      toast({
        title: "Payment Successful!",
        description: "Your booking is confirmed. You'll receive a confirmation email shortly.",
      });

      onPaymentComplete();
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Payment Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePayment} className="space-y-4">
          {/* Booking Summary */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Space:</span>
              <span className="font-medium">{booking.spaces?.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period:</span>
              <span className="font-medium">
                {new Date(booking.start_time).toLocaleDateString()} - {new Date(booking.end_time).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rate:</span>
              <span className="font-medium">${booking.final_price?.toFixed(2)}/hr</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total:</span>
              <span className="text-primary">${booking.total_price?.toFixed(2)}</span>
            </div>
          </div>

          {/* License Plate */}
          <div className="space-y-2">
            <Label htmlFor="licensePlate" className="text-sm font-medium">
              License Plate Number *
            </Label>
            <Input
              id="licensePlate"
              placeholder="ABC-1234"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
              className="apple-input h-10 sm:h-12 font-mono"
              required
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Required for space access and security purposes
            </p>
          </div>

          {/* Payment Method (Mock Stripe Form) */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold text-sm">Card Information</h4>

            <div className="space-y-2">
              <Label htmlFor="cardNumber" className="text-sm font-medium">
                Card Number *
              </Label>
              <Input
                id="cardNumber"
                placeholder="4242 4242 4242 4242"
                value={paymentMethod.cardNumber}
                onChange={(e) => setPaymentMethod(prev => ({ ...prev, cardNumber: e.target.value }))}
                className="apple-input h-10 sm:h-12 font-mono"
                required
                maxLength={19}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="expiryDate" className="text-sm font-medium">
                  Expiry *
                </Label>
                <Input
                  id="expiryDate"
                  placeholder="MM/YY"
                  value={paymentMethod.expiryDate}
                  onChange={(e) => setPaymentMethod(prev => ({ ...prev, expiryDate: e.target.value }))}
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
                  value={paymentMethod.cvv}
                  onChange={(e) => setPaymentMethod(prev => ({ ...prev, cvv: e.target.value }))}
                  className="apple-input h-10 sm:h-12 font-mono"
                  required
                  maxLength={4}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zipCode" className="text-sm font-medium">
                Billing ZIP Code *
              </Label>
              <Input
                id="zipCode"
                placeholder="12345"
                value={paymentMethod.zipCode}
                onChange={(e) => setPaymentMethod(prev => ({ ...prev, zipCode: e.target.value }))}
                className="apple-input h-10 sm:h-12"
                required
                maxLength={10}
              />
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Lock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              Your payment is secured with 256-bit SSL encryption. We never store your full card details.
            </p>
          </div>

          {/* Test Mode Notice */}
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-yellow-800">
              <strong>Test Mode:</strong> Use card number 4242 4242 4242 4242 with any future expiry date and any 3-digit CVV.
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !licensePlate}
            className="w-full apple-button-primary h-11 sm:h-12"
          >
            {loading ? (
              <>Processing Payment...</>
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Pay ${booking.total_price?.toFixed(2)}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By clicking "Pay", you agree to our Terms of Service and Privacy Policy
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

