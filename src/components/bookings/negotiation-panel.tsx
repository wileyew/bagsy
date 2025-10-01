import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, MessageCircle, CheckCircle, X, Send } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/lib/notification-service";
import { aiAgentNegotiationService, type NegotiationContext } from "@/lib/ai-agent-negotiation-service";

interface NegotiationPanelProps {
  booking: any;
  negotiations: any[];
  onUpdate: () => void;
}

export function NegotiationPanel({ booking, negotiations, onUpdate }: NegotiationPanelProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const [counterOffer, setCounterOffer] = useState(booking.final_price || booking.original_price);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isOwner = user?.id === booking.owner_id;
  const latestNegotiation = negotiations[0];

  const handleCounterOffer = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Create counter-offer
      const { error: negError } = await supabase
        .from('negotiations')
        .insert({
          booking_id: booking.id,
          from_user_id: user.id,
          to_user_id: isOwner ? booking.renter_id : booking.owner_id,
          offer_price: counterOffer,
          message: message,
          status: 'pending',
        });

      if (negError) throw negError;

      // Update booking status
      await supabase
        .from('bookings')
        .update({ 
          status: 'negotiating',
          final_price: counterOffer 
        })
        .eq('id', booking.id);

      // Send notification
      await notificationService.notifyNegotiationOffer(
        isOwner ? booking.renter_id : booking.owner_id,
        booking.id,
        user.email || 'User',
        counterOffer,
        message
      );

      toast({
        title: "Counter-Offer Sent",
        description: "The other party will be notified of your offer.",
      });

      setMessage("");
      onUpdate();

      // Trigger AI response if other party has AI enabled
      setTimeout(async () => {
        await triggerAIResponseIfEnabled(booking.id);
      }, 2000);

    } catch (error: any) {
      toast({
        title: "Failed to Send Offer",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const triggerAIResponseIfEnabled = async (bookingId: string) => {
    try {
      // Fetch latest negotiation data
      const { data: latestBooking } = await supabase
        .from('bookings')
        .select('*, spaces(*)')
        .eq('id', bookingId)
        .single();

      if (!latestBooking) return;

      const { data: negotiations } = await supabase
        .from('negotiations')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (!negotiations || negotiations.length === 0) return;

      // Get AI preferences (in production, fetch from database)
      const ownerPrefs = await aiAgentNegotiationService.getAIPreferences(
        latestBooking.owner_id,
        'owner'
      );
      const renterPrefs = await aiAgentNegotiationService.getAIPreferences(
        latestBooking.renter_id,
        'renter'
      );

      // Check if AI should respond
      if (!ownerPrefs.enabled && !renterPrefs.enabled) return;

      const context: NegotiationContext = {
        spaceId: latestBooking.space_id,
        ownerId: latestBooking.owner_id,
        renterId: latestBooking.renter_id,
        bookingId: latestBooking.id,
        originalPrice: latestBooking.original_price,
        currentOffer: negotiations[0].offer_price,
        listingData: latestBooking.spaces,
        negotiationHistory: negotiations,
        ownerPreferences: ownerPrefs,
        renterPreferences: renterPrefs,
      };

      const decision = await aiAgentNegotiationService.processNegotiationWithAI(context);
      
      if (decision) {
        toast({
          title: "🤖 AI Agent Responded",
          description: decision.reasoning,
        });
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to trigger AI response:', error);
    }
  };

  const handleAcceptOffer = async (negotiationId: string, offerPrice: number) => {
    setLoading(true);
    try {
      // Update negotiation
      await supabase
        .from('negotiations')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString() 
        })
        .eq('id', negotiationId);

      // Update booking
      await supabase
        .from('bookings')
        .update({ 
          status: 'accepted',
          final_price: offerPrice 
        })
        .eq('id', booking.id);

      // Create agreement
      const termsText = `
DRIVEWAY RENTAL AGREEMENT

Space: ${booking.spaces?.title || 'Driveway Space'}
Address: ${booking.spaces?.address || 'N/A'}

Rental Period:
From: ${new Date(booking.start_time).toLocaleString()}
To: ${new Date(booking.end_time).toLocaleString()}

Agreed Price: $${offerPrice.toFixed(2)} per hour
Total Amount: $${booking.total_price?.toFixed(2) || '0.00'}

Both parties agree to the terms and conditions of this rental agreement.
      `;

      const { data: agreement, error: agreementError } = await supabase
        .from('agreements')
        .insert({
          booking_id: booking.id,
          renter_id: booking.renter_id,
          owner_id: booking.owner_id,
          terms: termsText,
        })
        .select()
        .single();

      if (agreementError) throw agreementError;

      // Notify both parties
      await notificationService.notifyAgreementReady(
        booking.renter_id,
        booking.id,
        agreement.id
      );
      await notificationService.notifyAgreementReady(
        booking.owner_id,
        booking.id,
        agreement.id
      );

      toast({
        title: "Offer Accepted!",
        description: "Agreement has been created. Both parties need to sign.",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Failed to Accept Offer",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRejectOffer = async (negotiationId: string) => {
    setLoading(true);
    try {
      await supabase
        .from('negotiations')
        .update({ 
          status: 'rejected',
          responded_at: new Date().toISOString() 
        })
        .eq('id', negotiationId);

      toast({
        title: "Offer Rejected",
        description: "You can send a counter-offer below.",
      });

      onUpdate();
    } catch (error: any) {
      toast({
        title: "Failed to Reject Offer",
        description: error.message,
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
          <MessageCircle className="h-5 w-5" />
          Price Negotiation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Negotiation History */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {negotiations.map((neg) => (
            <div
              key={neg.id}
              className={`p-3 rounded-lg border ${
                neg.from_user_id === user?.id
                  ? 'bg-primary/5 border-primary/20 ml-8'
                  : neg.ai_generated
                  ? 'bg-purple-50 border-purple-200 mr-8'
                  : 'bg-muted mr-8'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm">
                      {neg.from_user_id === user?.id ? 'You' : (isOwner ? 'Renter' : 'Owner')}
                    </span>
                    {neg.ai_generated && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                        🤖 AI Agent
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      ${neg.offer_price.toFixed(2)}/hr
                    </Badge>
                    <Badge variant={neg.status === 'accepted' ? 'default' : 'secondary'} className="text-xs">
                      {neg.status}
                    </Badge>
                  </div>
                  {neg.message && (
                    <p className="text-sm text-muted-foreground">{neg.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(neg.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Action Buttons for Pending Offers */}
                {neg.status === 'pending' && neg.to_user_id === user?.id && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleAcceptOffer(neg.id, neg.offer_price)}
                      disabled={loading}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectOffer(neg.id)}
                      disabled={loading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Counter-Offer Form */}
        {booking.status !== 'accepted' && booking.status !== 'confirmed' && (
          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold text-sm">
              {latestNegotiation?.status === 'pending' && latestNegotiation.to_user_id === user?.id
                ? 'Counter-Offer'
                : 'Make an Offer'}
            </h4>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    value={counterOffer}
                    onChange={(e) => setCounterOffer(parseFloat(e.target.value) || 0)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                  />
                  <span className="text-sm text-muted-foreground">/hr</span>
                </div>
              </div>
            </div>

            <Textarea
              placeholder="Add a message (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[60px] resize-none"
            />

            <Button
              onClick={handleCounterOffer}
              disabled={loading || counterOffer <= 0}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Offer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

