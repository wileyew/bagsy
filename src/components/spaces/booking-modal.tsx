import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, DollarSign, MapPin, AlertCircle, CheckCircle, Shield, Loader2 } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { legalComplianceService, type LegalComplianceResult } from "@/lib/legal-compliance-service";
import { notificationService } from "@/lib/notification-service";
import { AIAgentSettings } from "@/components/ai-agent/ai-agent-settings";
import type { AIAgentPreferences } from "@/lib/ai-agent-negotiation-service";

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: any;
  onBookingCreated?: () => void;
}

export function BookingModal({ open, onOpenChange, space, onBookingCreated }: BookingModalProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checkingCompliance, setCheckingCompliance] = useState(false);
  const [complianceResult, setComplianceResult] = useState<LegalComplianceResult | null>(null);

  const [formData, setFormData] = useState({
    startTime: "",
    endTime: "",
    message: "",
    offerPrice: space?.price_per_hour || 0,
  });

  const [aiAgentPrefs, setAiAgentPrefs] = useState<AIAgentPreferences>({
    enabled: false,
    negotiationStrategy: 'moderate',
    autoAcceptThreshold: 1.05,
    maxCounterOffers: 5,
  });

  useEffect(() => {
    if (open && space) {
      setFormData(prev => ({
        ...prev,
        offerPrice: space.price_per_hour || 0,
      }));
      checkLegalCompliance();
    }
  }, [open, space]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !space) return;

    setLoading(true);
    try {
      const totalPrice = calculateTotalPrice();

      // Create booking
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

        // Notify owner of negotiation
        await notificationService.notifyNegotiationOffer(
          space.owner_id,
          booking.id,
          user.email || 'A user',
          formData.offerPrice,
          formData.message
        );
      } else {
        // Notify owner of booking request
        await notificationService.notifyBookingRequest(
          space.owner_id,
          booking.id,
          user.email || 'A user',
          space.title
        );
      }

      // Send legal compliance alert if needed
      if (complianceResult && complianceResult.status !== 'allowed') {
        await notificationService.notifyLegalAlert(
          user.id,
          booking.id,
          complianceResult.status,
          complianceResult.details.notes || 'Please review local regulations'
        );

        await notificationService.notifyLegalAlert(
          space.owner_id,
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

  const complianceDisplay = complianceResult && legalComplianceService.formatComplianceStatus(complianceResult.status);

  const { loading: authLoading } = useAuthContext();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="apple-card max-w-2xl w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)] mx-2 sm:mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-3 sm:space-y-4 px-2">
          <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            Book Space
          </DialogTitle>
          <div className="text-left space-y-2">
            <h3 className="font-semibold text-lg">{space?.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{space?.address}</span>
            </div>
          </div>
        </DialogHeader>

        {authLoading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <div>
                <p className="font-medium">Loading authentication...</p>
                <p className="text-xs mt-1 text-blue-700">
                  💡 Taking too long? Try: <strong>incognito mode</strong>, clear cookies, or restart your browser
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          {/* Legal Compliance Status */}
          {complianceResult && complianceDisplay && (
            <Card className={`border ${complianceDisplay.color}`}>
              <CardContent className="p-3 sm:p-4">
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
                    {complianceResult.details.requiresPermit && (
                      <div className="text-sm">
                        <strong>Permit Required:</strong> {complianceResult.details.permitUrl ? (
                          <a href={complianceResult.details.permitUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            Get Permit
                          </a>
                        ) : 'Contact local authorities'}
                      </div>
                    )}
                    {complianceResult.details.restrictions && complianceResult.details.restrictions.length > 0 && (
                      <div className="text-sm">
                        <strong>Restrictions:</strong>
                        <ul className="list-disc pl-5 mt-1">
                          {complianceResult.details.restrictions.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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

          {/* AI Agent Settings */}
          <div className="pt-4 border-t">
            <AIAgentSettings
              role="renter"
              listingPrice={space?.price_per_hour}
              preferences={aiAgentPrefs}
              onPreferencesChange={setAiAgentPrefs}
              compact={true}
            />
            {aiAgentPrefs.enabled && (
              <p className="text-xs text-muted-foreground mt-2 px-3">
                💡 AI will automatically negotiate on your behalf if the owner counters your offer
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || checkingCompliance}
            className="w-full apple-button-primary h-11 sm:h-12 text-sm sm:text-base"
          >
            {loading ? "Sending Request..." : "Send Booking Request"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            You won't be charged until the owner accepts your request
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}

