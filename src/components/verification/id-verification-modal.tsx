import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, 
  CreditCard, 
  MapPin, 
  UserCheck, 
  Crown,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { tieredVerificationService, VerificationTier } from "@/lib/tiered-verification-service";
import { stripeIdentityService } from "@/lib/stripe-identity-service";

interface IDVerificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerificationComplete?: (tier: VerificationTier) => void;
  trigger?: 'listing_high_value' | 'manual_request' | 'upgrade_prompt';
  currentTier?: VerificationTier;
}

export function IDVerificationModal({
  open,
  onOpenChange,
  onVerificationComplete,
  trigger = 'manual_request',
  currentTier = 'basic'
}: IDVerificationModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'intro' | 'stripe_identity' | 'processing' | 'complete'>('intro');
  const [verificationStatus, setVerificationStatus] = useState<any>(null);

  // Get current verification status
  useEffect(() => {
    const getStatus = async () => {
      if (user && open) {
        const status = await tieredVerificationService.getUserVerificationStatus(user.id);
        setVerificationStatus(status);
      }
    };
    getStatus();
  }, [user, open]);

  const handleStartVerification = async () => {
    if (!user) return;

    setLoading(true);
    setStep('stripe_identity');

    try {
      // Start Stripe Identity verification
      const { verificationUrl, sessionId } = await stripeIdentityService.verifyUserIdentity(user.id);
      
      // Save session ID for later
      sessionStorage.setItem('stripe_verification_session', sessionId);
      
      // Redirect user to Stripe's hosted verification page
      window.location.href = verificationUrl;
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Could not start ID verification. Please try again.",
        variant: "destructive",
      });
      setStep('intro');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
    if (trigger === 'upgrade_prompt') {
      toast({
        title: "Verification Skipped",
        description: "You can upgrade your verification level anytime from your profile.",
      });
    }
  };

  const getTriggerMessage = () => {
    switch (trigger) {
      case 'listing_high_value':
        return {
          title: "ID Verification Required",
          description: "High-value listings require ID verification for security and trust.",
        };
      case 'upgrade_prompt':
        return {
          title: "Unlock Premium Features",
          description: "Complete ID verification to access premium features and increase your earnings.",
        };
      default:
        return {
          title: "Verify Your Identity",
          description: "Complete ID verification to build trust and unlock premium features.",
        };
    }
  };

  const triggerMessage = getTriggerMessage();

  if (step === 'complete') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-6 w-6" />
              Verification Complete!
            </DialogTitle>
          </DialogHeader>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    <Crown className="h-4 w-4 mr-2" />
                    ID Verified
                  </Badge>
                </div>
                
                <p className="text-muted-foreground">
                  Your identity has been verified successfully. You now have access to premium features!
                </p>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 text-green-600 mb-1">
                      <Star className="h-4 w-4" />
                      <span className="font-medium">High-Value Listings</span>
                    </div>
                    <p className="text-xs text-green-700">List spaces over $100/day</p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="font-medium">Verified Badge</span>
                    </div>
                    <p className="text-xs text-blue-700">Build more trust with guests</p>
                  </div>
                </div>

                <Button 
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{triggerMessage.title}</DialogTitle>
          <DialogDescription>{triggerMessage.description}</DialogDescription>
        </DialogHeader>

        {step === 'intro' && (
          <div className="space-y-6">
            {/* Current Status */}
            {verificationStatus && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    Current Verification Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <Badge variant="outline" className="capitalize">
                        {verificationStatus.tier.replace('_', ' ')}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        Score: {verificationStatus.score}/100
                      </p>
                    </div>
                    <Progress value={verificationStatus.score} className="w-24" />
                  </div>
                  
                  {verificationStatus.badges.length > 0 && (
                    <div className="flex gap-2">
                      {verificationStatus.badges.map((badge: string) => (
                        <Badge key={badge} variant="secondary" className="text-xs">
                          {badge.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Verification Tiers */}
            <div className="space-y-4">
              <h3 className="font-semibold">Verification Tiers</h3>
              
              {/* Current Tier */}
              <Card className={currentTier === 'basic' ? 'border-primary' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-sm font-medium">1</span>
                      </div>
                      <div>
                        <h4 className="font-medium">Basic</h4>
                        <p className="text-sm text-muted-foreground">New user</p>
                      </div>
                    </div>
                    {currentTier === 'basic' && (
                      <Badge variant="outline">Current</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Verified */}
              <Card className={currentTier === 'payment_verified' ? 'border-primary' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <CreditCard className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-medium">Payment Verified</h4>
                        <p className="text-sm text-muted-foreground">Payment method + address verified</p>
                      </div>
                    </div>
                    {currentTier === 'payment_verified' && (
                      <Badge variant="outline">Current</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ID Verified */}
              <Card className={currentTier === 'id_verified' ? 'border-primary' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <ShieldCheck className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium">ID Verified</h4>
                        <p className="text-sm text-muted-foreground">Government ID verified</p>
                      </div>
                    </div>
                    {currentTier === 'id_verified' ? (
                      <Badge variant="outline">Current</Badge>
                    ) : (
                      <Badge variant="secondary">Target</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Premium Verified */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                        <Crown className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h4 className="font-medium">Premium Verified</h4>
                        <p className="text-sm text-muted-foreground">Verified Host badge</p>
                      </div>
                    </div>
                    <Badge variant="outline">Premium</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Benefits of ID Verification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Benefits of ID Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">High-Value Listings</p>
                      <p className="text-xs text-muted-foreground">List spaces over $100/day</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Verified Badge</p>
                      <p className="text-xs text-muted-foreground">Build trust with guests</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Priority Support</p>
                      <p className="text-xs text-muted-foreground">Faster customer service</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Lower Fees</p>
                      <p className="text-xs text-muted-foreground">Reduced transaction fees</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security Notice */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Secure & Private</p>
                  <p>Your ID verification is handled securely by Stripe Identity. We never store your ID documents, and verification typically takes 2-3 minutes.</p>
                </div>
              </div>
            </div>

            {/* Cost Notice */}
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium mb-1">Verification Cost</p>
                  <p>ID verification costs $1.50 and is processed securely by Stripe. This one-time fee unlocks premium features permanently.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleStartVerification}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Start ID Verification ($1.50)
                  </>
                )}
              </Button>
              
              {trigger !== 'listing_high_value' && (
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="px-6"
                >
                  Skip for Now
                </Button>
              )}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By proceeding, you agree to our Terms of Service and Privacy Policy
            </p>
          </div>
        )}

        {step === 'stripe_identity' && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <div>
                  <h3 className="font-semibold">Redirecting to Verification</h3>
                  <p className="text-sm text-muted-foreground">
                    You'll be redirected to Stripe's secure verification page. 
                    Please complete the verification process there.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
