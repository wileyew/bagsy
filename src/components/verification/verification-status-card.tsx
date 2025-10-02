import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ShieldCheck, 
  CreditCard, 
  MapPin, 
  UserCheck, 
  Crown,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Star,
  Zap
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { tieredVerificationService, VerificationTier, VerificationStatus } from "@/lib/tiered-verification-service";
import { IDVerificationModal } from "./id-verification-modal";

interface VerificationStatusCardProps {
  showUpgradeButton?: boolean;
  compact?: boolean;
}

export function VerificationStatusCard({ 
  showUpgradeButton = true, 
  compact = false 
}: VerificationStatusCardProps) {
  const { user } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIDModal, setShowIDModal] = useState(false);

  useEffect(() => {
    const getStatus = async () => {
      if (user) {
        const status = await tieredVerificationService.getUserVerificationStatus(user.id);
        setVerificationStatus(status);
      }
      setLoading(false);
    };
    getStatus();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <div className="animate-pulse h-4 w-4 bg-muted rounded" />
            <span className="text-sm text-muted-foreground">Loading verification status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!verificationStatus) {
    return null;
  }

  const getTierIcon = (tier: VerificationTier) => {
    switch (tier) {
      case 'basic':
        return <UserCheck className="h-4 w-4" />;
      case 'payment_verified':
        return <CreditCard className="h-4 w-4" />;
      case 'id_verified':
        return <ShieldCheck className="h-4 w-4" />;
      case 'premium_verified':
        return <Crown className="h-4 w-4" />;
      default:
        return <UserCheck className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier: VerificationTier) => {
    switch (tier) {
      case 'basic':
        return 'bg-muted text-muted-foreground';
      case 'payment_verified':
        return 'bg-blue-100 text-blue-700';
      case 'id_verified':
        return 'bg-green-100 text-green-700';
      case 'premium_verified':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getTierBenefits = (tier: VerificationTier) => {
    switch (tier) {
      case 'basic':
        return ['Make bookings', 'List basic spaces'];
      case 'payment_verified':
        return ['Faster booking approval', 'Address verification', 'All Basic benefits'];
      case 'id_verified':
        return ['High-value listings', 'Priority support', 'All Payment Verified benefits'];
      case 'premium_verified':
        return ['Verified Host badge', 'Premium features', 'All ID Verified benefits'];
      default:
        return [];
    }
  };

  const canUpgrade = verificationStatus.tier === 'basic' || verificationStatus.tier === 'payment_verified';
  const tierBenefits = getTierBenefits(verificationStatus.tier);

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getTierColor(verificationStatus.tier)}`}>
          {getTierIcon(verificationStatus.tier)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize text-xs">
              {verificationStatus.tier.replace('_', ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {verificationStatus.score}/100
            </span>
          </div>
          {verificationStatus.badges.length > 0 && (
            <div className="flex gap-1 mt-1">
              {verificationStatus.badges.map((badge) => (
                <Badge key={badge} variant="secondary" className="text-xs">
                  {badge.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {canUpgrade && showUpgradeButton && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowIDModal(true)}
          >
            Upgrade
          </Button>
        )}
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Verification Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Tier */}
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getTierColor(verificationStatus.tier)}`}>
              {getTierIcon(verificationStatus.tier)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="capitalize">
                  {verificationStatus.tier.replace('_', ' ')}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {verificationStatus.score}/100 points
                </span>
              </div>
              <Progress value={verificationStatus.score} className="w-full" />
            </div>
          </div>

          {/* Badges */}
          {verificationStatus.badges.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Badges Earned</h4>
              <div className="flex gap-2 flex-wrap">
                {verificationStatus.badges.map((badge) => (
                  <Badge key={badge} variant="secondary">
                    <Star className="h-3 w-3 mr-1" />
                    {badge.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Current Benefits */}
          <div>
            <h4 className="text-sm font-medium mb-2">Your Benefits</h4>
            <div className="space-y-1">
              {tierBenefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Requirements Status */}
          <div>
            <h4 className="text-sm font-medium mb-2">Requirements</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                {verificationStatus.requirements.paymentSetup ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={verificationStatus.requirements.paymentSetup ? 'text-green-700' : 'text-muted-foreground'}>
                  Payment method set up
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {verificationStatus.requirements.addressVerified ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={verificationStatus.requirements.addressVerified ? 'text-green-700' : 'text-muted-foreground'}>
                  Address verified
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {verificationStatus.requirements.idVerified ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={verificationStatus.requirements.idVerified ? 'text-green-700' : 'text-muted-foreground'}>
                  ID verified
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                {verificationStatus.requirements.verifiedHostBadge ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className={verificationStatus.requirements.verifiedHostBadge ? 'text-green-700' : 'text-muted-foreground'}>
                  Verified Host badge
                </span>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          {verificationStatus.nextSteps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Next Steps</h4>
              <div className="space-y-1">
                {verificationStatus.nextSteps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <ArrowRight className="h-3 w-3 text-primary flex-shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upgrade Button */}
          {canUpgrade && showUpgradeButton && (
            <Button 
              onClick={() => setShowIDModal(true)}
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Upgrade Verification
            </Button>
          )}

          {/* Special Features */}
          {verificationStatus.canCreateHighValueListings && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <Crown className="h-4 w-4" />
                <span className="text-sm font-medium">Premium Access</span>
              </div>
              <p className="text-xs text-green-700 mt-1">
                You can create high-value listings and access premium features!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <IDVerificationModal
        open={showIDModal}
        onOpenChange={setShowIDModal}
        trigger="upgrade_prompt"
        currentTier={verificationStatus.tier}
        onVerificationComplete={(newTier) => {
          setShowIDModal(false);
          // Refresh status
          if (user) {
            tieredVerificationService.getUserVerificationStatus(user.id)
              .then(setVerificationStatus);
          }
        }}
      />
    </>
  );
}
