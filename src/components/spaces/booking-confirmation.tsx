import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  Clock, 
  DollarSign, 
  MapPin, 
  Calendar, 
  User, 
  CreditCard, 
  Shield, 
  Star,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { tieredVerificationService, type VerificationTier, type UserVerificationStatus } from "@/lib/tiered-verification-service";
import { PaymentSetupModal } from "@/components/payments/payment-setup-modal";

interface BookingConfirmationProps {
  booking: any;
  onClose: () => void;
  onPaymentSetup?: () => void;
}

export function BookingConfirmation({ booking, onClose, onPaymentSetup }: BookingConfirmationProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);

  useEffect(() => {
    if (user && booking) {
      loadUserVerificationStatus();
    }
  }, [user, booking]);

  const loadUserVerificationStatus = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const status = await tieredVerificationService.getUserVerificationStatus(user.id);
      setVerificationStatus(status);
    } catch (error) {
      console.error('Failed to load verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSetup = () => {
    setPaymentSetupOpen(true);
  };

  const handlePaymentSetupComplete = async () => {
    await loadUserVerificationStatus();
    setPaymentSetupOpen(false);
    onPaymentSetup?.();
    toast({
      title: "Payment Method Added!",
      description: "Your verification status has been updated.",
    });
  };

  const getTierIcon = (tier: VerificationTier) => {
    switch (tier) {
      case 'basic': return <User className="h-4 w-4" />;
      case 'payment_verified': return <CreditCard className="h-4 w-4" />;
      case 'id_verified': return <Shield className="h-4 w-4" />;
      case 'premium_verified': return <Star className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier: VerificationTier) => {
    switch (tier) {
      case 'basic': return 'bg-gray-100 text-gray-800';
      case 'payment_verified': return 'bg-blue-100 text-blue-800';
      case 'id_verified': return 'bg-green-100 text-green-800';
      case 'premium_verified': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getBookingStatus = () => {
    if (!verificationStatus) return 'loading';
    
    if (!verificationStatus.paymentMethodSetup) {
      return 'payment_required';
    }
    
    if (booking.status === 'pending') {
      return 'pending_owner';
    }
    
    if (booking.status === 'confirmed') {
      return 'confirmed';
    }
    
    return booking.status;
  };

  const bookingStatus = getBookingStatus();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading booking confirmation...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            Booking Confirmation
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Booking Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Booking Details</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground">{booking.space?.title}</p>
                  <p className="text-xs text-muted-foreground">{booking.space?.address}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Date & Time</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(booking.start_time).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(booking.start_time).toLocaleTimeString()} - {new Date(booking.end_time).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Duration</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60) * 10) / 10} hours
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Total Price</p>
                  <p className="text-lg font-semibold text-primary">${booking.total_price?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Verification Status */}
          {verificationStatus && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Your Verification Status</h3>
              
              <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                <div className={`p-2 rounded-full ${getTierColor(verificationStatus.tier)}`}>
                  {getTierIcon(verificationStatus.tier)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {verificationStatus.tier.replace('_', ' ').toUpperCase()}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      Score: {verificationStatus.overallScore}/100
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {verificationStatus.paymentMethodSetup ? 'Payment verified' : 'Payment verification required'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Booking Status */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Booking Status</h3>
            
            {bookingStatus === 'payment_required' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  You need to set up a payment method to complete this booking. This helps verify your identity and address.
                </AlertDescription>
              </Alert>
            )}
            
            {bookingStatus === 'pending_owner' && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Your booking request has been sent to the space owner. You'll be notified when they respond.
                </AlertDescription>
              </Alert>
            )}
            
            {bookingStatus === 'confirmed' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your booking has been confirmed! You can now access the space during your reserved time.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Next Steps */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Next Steps</h3>
            
            <div className="space-y-3">
              {bookingStatus === 'payment_required' && (
                <div className="flex items-center justify-between p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-orange-600" />
                    <div>
                      <p className="font-medium">Set up payment method</p>
                      <p className="text-sm text-muted-foreground">Required for booking confirmation</p>
                    </div>
                  </div>
                  <Button onClick={handlePaymentSetup} size="sm">
                    Setup Payment
                  </Button>
                </div>
              )}
              
              {bookingStatus === 'pending_owner' && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium">Waiting for owner response</p>
                    <p className="text-sm text-muted-foreground">Check your notifications for updates</p>
                  </div>
                </div>
              )}
              
              {bookingStatus === 'confirmed' && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">Booking confirmed</p>
                    <p className="text-sm text-muted-foreground">Access details will be shared closer to your booking time</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Close
            </Button>
            {bookingStatus === 'confirmed' && (
              <Button onClick={() => window.location.href = '/my-bookings'} className="flex-1">
                View All Bookings
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Setup Modal */}
      <PaymentSetupModal
        open={paymentSetupOpen}
        onOpenChange={setPaymentSetupOpen}
        onComplete={handlePaymentSetupComplete}
      />
    </>
  );
}
