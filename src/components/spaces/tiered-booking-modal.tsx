import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  MapPin, 
  AlertCircle, 
  CheckCircle, 
  Shield, 
  Loader2, 
  CreditCard,
  User,
  FileText,
  Star,
  Lock,
  Zap
} from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { legalComplianceService, type LegalComplianceResult } from "@/lib/legal-compliance-service";
import { notificationService } from "@/lib/notification-service";
import { tieredVerificationService } from "@/lib/tiered-verification-service";
import { PaymentSetupModal } from "@/components/payments/payment-setup-modal";
import { VerificationStatusCard } from "@/components/verification/verification-status-card";
import type { VerificationTier, UserVerificationStatus } from "@/lib/tiered-verification-service";

interface TieredBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: any;
  onBookingCreated?: () => void;
}

interface BookingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
}

export function TieredBookingModal({ open, onOpenChange, space, onBookingCreated }: TieredBookingModalProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  
  // Booking form state
  const [formData, setFormData] = useState({
    startTime: "",
    endTime: "",
    message: "",
    offerPrice: space?.price_per_hour || 0,
  });

  // Verification and payment state
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [currentTier, setCurrentTier] = useState<VerificationTier>('basic');
  const [paymentSetupOpen, setPaymentSetupOpen] = useState(false);
  const [complianceResult, setComplianceResult] = useState<LegalComplianceResult | null>(null);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [loadingVerification, setLoadingVerification] = useState(false);

  // Booking steps based on verification tier
  const [bookingSteps, setBookingSteps] = useState<BookingStep[]>([]);

  useEffect(() => {
    if (open && space && user) {
      setFormData(prev => ({
        ...prev,
        offerPrice: space.price_per_hour || 0,
      }));
      loadUserVerificationStatus();
      checkLegalCompliance();
    }
  }, [open, space, user]);

  useEffect(() => {
    if (verificationStatus) {
      updateBookingSteps();
    }
  }, [verificationStatus]);

  const loadUserVerificationStatus = async () => {
    if (!user) return;

    setLoadingVerification(true);
    try {
      const status = await tieredVerificationService.getUserVerificationStatus(user.id);
      setVerificationStatus(status);
      setCurrentTier(status.tier);
    } catch (error) {
      console.error('Failed to load verification status:', error);
      // Default to basic tier if there's an error
      setCurrentTier('basic');
    } finally {
      setLoadingVerification(false);
    }
  };

  const updateBookingSteps = () => {
    const baseSteps: BookingStep[] = [
      {
        id: 'verify-identity',
        title: 'Verify Identity',
        description: 'Set up payment method for address verification',
        completed: verificationStatus?.paymentMethodSetup || false,
        required: true
      },
      {
        id: 'check-compliance',
        title: 'Legal Compliance',
        description: 'Review local regulations and restrictions',
        completed: !!complianceResult && complianceResult.status === 'allowed',
        required: true
      },
      {
        id: 'book-space',
        title: 'Complete Booking',
        description: 'Submit your reservation request',
        completed: false,
        required: true
      }
    ];

    // Add premium steps for higher tiers
    if (currentTier === 'premium_verified') {
      baseSteps.push({
        id: 'premium-benefits',
        title: 'Premium Benefits',
        description: 'Access to premium features and priority support',
        completed: true,
        required: false
      });
    }

    setBookingSteps(baseSteps);
  };

  const checkLegalCompliance = async () => {
    if (!space) return;

    setCheckingCompliance(true);
    try {
      const result = await legalComplianceService.checkCompliance(
        space.address,
        space.zip_code
      );
      setComplianceResult(result);
    } catch (error) {
      console.error('Legal compliance check failed:', error);
    } finally {
      setCheckingCompliance(false);
    }
  };

  const calculateTotalPrice = () => {
    if (!formData.startTime || !formData.endTime) return 0;

    const start = new Date(formData.startTime);
    const end = new Date(formData.endTime);
    const hours = Math.abs(end.getTime() - start.getTime()) / 36e5;

    return hours * formData.offerPrice;
  };

  const getTierBenefits = () => {
    const benefits = {
      basic: [
        'Basic booking access',
        'Standard support'
      ],
      payment_verified: [
        'Payment method verified',
        'Address verification',
        'Faster booking approval',
        'Priority customer support'
      ],
      id_verified: [
        'All payment benefits',
        'Government ID verified',
        'Enhanced security',
        'Premium listing access'
      ],
      premium_verified: [
        'All previous benefits',
        'Instant booking approval',
        'Exclusive premium spaces',
        'Dedicated support team',
        'Early access to new features'
      ]
    };

    return benefits[currentTier] || benefits.basic;
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

  const canProceedWithBooking = () => {
    return verificationStatus?.paymentMethodSetup && 
           complianceResult?.status === 'allowed' &&
           formData.startTime && 
           formData.endTime;
  };

  const handlePaymentSetupComplete = async () => {
    await loadUserVerificationStatus();
    setPaymentSetupOpen(false);
    toast({
      title: "Payment Method Added!",
      description: "Your address has been verified and you can now proceed with booking.",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !space || !canProceedWithBooking()) return;

    setLoading(true);
    try {
      const totalPrice = calculateTotalPrice();

      // Create booking with verification metadata
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          space_id: space.id,
          renter_id: user.id,
          owner_id: space.owner_id,
          start_time: formData.startTime,
          end_time: formData.endTime,
          status: 'pending',
          original_price: space.price_per_hour,
          final_price: formData.offerPrice,
          total_price: totalPrice,
          payment_status: 'pending',
          legal_compliance_checked: !!complianceResult,
          legal_compliance_status: complianceResult?.status || 'pending',
          legal_compliance_details: complianceResult || null,
          renter_verification_tier: currentTier,
          renter_verification_score: verificationStatus?.overallScore || 0,
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // Create initial negotiation if price is different
      if (formData.offerPrice !== space.price_per_hour) {
        const { error: negError } = await supabase
          .from('negotiations')
          .insert({
            booking_id: booking.id,
            from_user_id: user.id,
            to_user_id: space.owner_id,
            offer_price: formData.offerPrice,
            message: formData.message,
            status: 'pending',
          });

        if (negError) console.error('Negotiation creation error:', negError);
      }

      // Send notifications
      await notificationService.notifyBookingRequest(
        space.owner_id,
        booking.id,
        user.email || 'A user',
        space.title
      );

      // Send legal compliance alert if needed
      if (complianceResult && complianceResult.status !== 'allowed') {
        await notificationService.notifyLegalAlert(
          user.id,
          booking.id,
          complianceResult.status,
          complianceResult.details.notes || 'Please review local regulations'
        );
      }

      toast({
        title: "Booking Request Sent!",
        description: `Your request for "${space.title}" has been sent to the owner. You'll be notified when they respond.`,
      });

      onOpenChange(false);
      onBookingCreated?.();
    } catch (error: any) {
      console.error('Booking error:', error);
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const completedSteps = bookingSteps.filter(step => step.completed).length;
  const totalRequiredSteps = bookingSteps.filter(step => step.required).length;
  const progressPercentage = (completedSteps / totalRequiredSteps) * 100;

  const complianceDisplay = complianceResult && legalComplianceService.formatComplianceStatus(complianceResult.status);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="apple-card max-w-4xl w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-center space-y-3 sm:space-y-4 px-2">
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
              Reserve Space
            </DialogTitle>
            <div className="text-left space-y-2">
              <h3 className="font-semibold text-lg">{space?.title}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{space?.address}</span>
              </div>
            </div>
          </DialogHeader>

          {/* Verification Status Card */}
          {loadingVerification ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading verification status...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <VerificationStatusCard 
              currentTier={currentTier}
              verificationStatus={verificationStatus}
              onUpgrade={() => setPaymentSetupOpen(true)}
            />
          )}

          {/* Booking Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Booking Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Completion Progress</span>
                  <span>{completedSteps}/{totalRequiredSteps} steps</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>

              <div className="space-y-3">
                {bookingSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.completed 
                        ? 'bg-green-100 text-green-800' 
                        : step.required 
                          ? 'bg-orange-100 text-orange-800' 
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {step.completed ? <CheckCircle className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${step.completed ? 'text-green-800' : 'text-gray-900'}`}>
                          {step.title}
                        </span>
                        {!step.required && <Badge variant="outline" className="text-xs">Optional</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                    </div>
                    {step.id === 'verify-identity' && !step.completed && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setPaymentSetupOpen(true)}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Setup
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tier Benefits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getTierIcon(currentTier)}
                Your Benefits ({currentTier.replace('_', ' ').toUpperCase()})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {getTierBenefits().map((benefit, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span>{benefit}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Legal Compliance Status */}
          {complianceResult && complianceDisplay && (
            <Card className={`border ${complianceDisplay.color}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Legal Status:</span>
                      <Badge variant="outline" className={complianceDisplay.color}>
                        {complianceDisplay.icon} {complianceDisplay.label}
                      </Badge>
                    </div>
                    <p className="text-sm">{complianceResult.details.notes}</p>
                    {complianceResult.status !== 'allowed' && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Please review local regulations before proceeding with your booking.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            {/* Time Selection */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold">Booking Period</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime" className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Start Date & Time *
                  </Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="apple-input h-10 sm:h-12 text-sm sm:text-base"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime" className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    End Date & Time *
                  </Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="apple-input h-10 sm:h-12 text-sm sm:text-base"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-semibold">Pricing</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm text-muted-foreground">Listed Price (per hour)</span>
                  <span className="font-semibold">${space?.price_per_hour?.toFixed(2)}</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="offerPrice" className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Your Offer (per hour)
                  </Label>
                  <Input
                    id="offerPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.offerPrice}
                    onChange={(e) => setFormData(prev => ({ ...prev, offerPrice: parseFloat(e.target.value) || 0 }))}
                    className="apple-input h-10 sm:h-12 text-sm sm:text-base"
                    required
                  />
                  {formData.offerPrice !== space?.price_per_hour && (
                    <p className="text-xs text-muted-foreground">
                      This will start a negotiation with the owner
                    </p>
                  )}
                </div>

                {formData.startTime && formData.endTime && (
                  <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <span className="font-semibold">Total Price</span>
                    <span className="text-xl font-bold text-primary">${calculateTotalPrice().toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium">
                Message to Owner (Optional)
              </Label>
              <Textarea
                id="message"
                placeholder="Add any special requests or questions..."
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                className="apple-input min-h-[80px] resize-none text-sm sm:text-base"
              />
            </div>

            <Separator />

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || checkingCompliance || !canProceedWithBooking()}
              className="w-full apple-button-primary h-11 sm:h-12 text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending Request...
                </>
              ) : !canProceedWithBooking() ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Complete Verification to Book
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Send Booking Request
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You won't be charged until the owner accepts your request
            </p>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Setup Modal */}
      <PaymentSetupModal
        open={paymentSetupOpen}
        onOpenChange={setPaymentSetupOpen}
        onComplete={handlePaymentSetupComplete}
      />
    </>
  );
}
