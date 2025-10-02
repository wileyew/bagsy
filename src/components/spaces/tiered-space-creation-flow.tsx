import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  CheckCircle, 
  Crown, 
  ShieldCheck, 
  CreditCard,
  MapPin,
  Zap,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { tieredVerificationService, ListingVerificationResult } from "@/lib/tiered-verification-service";
import { IDVerificationModal } from "@/components/verification/id-verification-modal";
import { PaymentSetupModal } from "@/components/payments/payment-setup-modal";

interface TieredSpaceCreationFlowProps {
  onListingCreated: (listingData: any) => void;
  onCancel: () => void;
}

export function TieredSpaceCreationFlow({ 
  onListingCreated, 
  onCancel 
}: TieredSpaceCreationFlowProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState<'payment_setup' | 'form' | 'verification' | 'processing'>('payment_setup');
  const [verificationResult, setVerificationResult] = useState<ListingVerificationResult | null>(null);
  const [showIDModal, setShowIDModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  const [loadingVerification, setLoadingVerification] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    space_type: 'garage',
    price_per_hour: 0,
    price_per_day: 0,
    address: '',
    city: '',
    state: '',
    zip_code: '',
    dimensions: '',
  });

  // Check verification status on mount
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (!user) return;

      setLoadingVerification(true);
      try {
        const status = await tieredVerificationService.getUserVerificationStatus(user.id);
        setVerificationStatus(status);
        
        // If user already has payment method setup, skip to form
        if (status.paymentMethodSetup) {
          setStep('form');
        }
      } catch (error) {
        console.error('Failed to load verification status:', error);
      } finally {
        setLoadingVerification(false);
      }
    };

    checkVerificationStatus();
  }, [user]);

  const handlePaymentSetupComplete = async () => {
    setShowPaymentModal(false);
    
    // Refresh verification status
    try {
      const status = await tieredVerificationService.getUserVerificationStatus(user.id);
      setVerificationStatus(status);
      
      if (status.paymentMethodSetup) {
        setStep('form');
        toast({
          title: "Payment Method Added!",
          description: "Your address has been verified. You can now proceed with listing your space.",
        });
      }
    } catch (error) {
      console.error('Failed to refresh verification status:', error);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setStep('verification');

    try {
      // Check if user can create this listing
      const result = await tieredVerificationService.canCreateListing(user.id, formData);
      setVerificationResult(result);

      if (result.canCreate) {
        // Can create immediately
        await createListing();
      } else {
        // Needs verification
        if (result.tierRequired === 'id_verified') {
          setShowIDModal(true);
        } else {
          setShowPaymentModal(true);
        }
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message || "Could not verify listing requirements.",
        variant: "destructive",
      });
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const createListing = async () => {
    try {
      // Here you would create the actual listing
      // For now, we'll simulate it
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: "Listing Created!",
        description: "Your space has been successfully listed.",
      });
      
      onListingCreated(formData);
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create listing.",
        variant: "destructive",
      });
    }
  };

  const isHighValueListing = (formData.price_per_day || formData.price_per_hour * 24) > 100;

  if (step === 'verification' && verificationResult) {
    return (
      <div className="space-y-6">
        {/* Verification Result */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {verificationResult.canCreate ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              Listing Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {verificationResult.canCreate ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Your listing meets all requirements and can be created immediately.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {verificationResult.reason || "Additional verification required to create this listing."}
                </AlertDescription>
              </Alert>
            )}

            {/* Suggestions */}
            {verificationResult.suggestions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Recommendations:</h4>
                <ul className="space-y-1">
                  {verificationResult.suggestions.map((suggestion, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <ArrowRight className="h-3 w-3 text-primary flex-shrink-0 mt-0.5" />
                      <span>{suggestion}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* High Value Notice */}
            {isHighValueListing && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-800">
                  <Crown className="h-4 w-4" />
                  <span className="font-medium">High-Value Listing</span>
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  Listings over $100/day require ID verification for security and trust.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              {verificationResult.canCreate ? (
                <Button 
                  onClick={createListing}
                  className="flex-1"
                >
                  Create Listing
                </Button>
              ) : (
                <>
                  {verificationResult.tierRequired === 'id_verified' && (
                    <Button 
                      onClick={() => setShowIDModal(true)}
                      className="flex-1"
                    >
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Verify ID ($1.50)
                    </Button>
                  )}
                  {verificationResult.tierRequired === 'payment_verified' && (
                    <Button 
                      onClick={() => setShowPaymentModal(true)}
                      className="flex-1"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Set Up Payment
                    </Button>
                  )}
                </>
              )}
              
              <Button 
                variant="outline"
                onClick={() => setStep('form')}
              >
                Back to Form
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tier Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Verification Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Basic Tier */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-sm font-medium">1</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Basic</h4>
                    <p className="text-xs text-muted-foreground">Standard listings</p>
                  </div>
                </div>
                <Badge variant="outline">Current</Badge>
              </div>

              {/* Payment Verified */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Payment Verified</h4>
                    <p className="text-xs text-muted-foreground">Address verification</p>
                  </div>
                </div>
                <Badge variant="secondary">Target</Badge>
              </div>

              {/* ID Verified */}
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">ID Verified</h4>
                    <p className="text-xs text-muted-foreground">High-value listings</p>
                  </div>
                </div>
                {isHighValueListing && (
                  <Badge variant="secondary">Required</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Payment setup step
  if (step === 'payment_setup') {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Setup Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Set Up Payment Method</h3>
                <p className="text-muted-foreground">
                  To list your space, we need to verify your identity and address through a payment method. 
                  This helps ensure trust and safety for all users.
                </p>
              </div>
            </div>

            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription>
                <strong>Why we need this:</strong> Your payment information helps us verify your identity 
                and address, creating a safer marketplace for everyone. You won't be charged until 
                someone books your space.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button 
                onClick={() => setShowPaymentModal(true)}
                className="flex-1"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Set Up Payment Method
              </Button>
              <Button 
                variant="outline"
                onClick={onCancel}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading verification status
  if (loadingVerification) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mx-auto w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Checking verification status...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Space Listing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                  placeholder="e.g., Secure Garage in Downtown"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Space Type *</label>
                <select
                  value={formData.space_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, space_type: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  <option value="garage">Garage</option>
                  <option value="driveway">Driveway</option>
                  <option value="parking_spot">Parking Spot</option>
                  <option value="warehouse">Warehouse</option>
                  <option value="storage_unit">Storage Unit</option>
                  <option value="outdoor_space">Outdoor Space</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-2 border rounded-md"
                rows={3}
                placeholder="Describe your space, amenities, and any special instructions..."
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Price per Hour ($) *</label>
                <input
                  type="number"
                  value={formData.price_per_hour}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    price_per_hour: parseFloat(e.target.value) || 0,
                    price_per_day: parseFloat(e.target.value) * 24 || 0
                  }))}
                  className="w-full p-2 border rounded-md"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Daily Rate ($)</label>
                <input
                  type="number"
                  value={formData.price_per_day}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    price_per_day: parseFloat(e.target.value) || 0,
                    price_per_hour: parseFloat(e.target.value) / 24 || 0
                  }))}
                  className="w-full p-2 border rounded-md"
                  min="0"
                  step="0.01"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-calculated from hourly rate
                </p>
              </div>
            </div>

            {/* High Value Notice */}
            {isHighValueListing && (
              <Alert>
                <Crown className="h-4 w-4" />
                <AlertDescription>
                  This is a high-value listing (${formData.price_per_day}/day). ID verification will be required.
                </AlertDescription>
              </Alert>
            )}

            {/* Address */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Address *</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                className="w-full p-2 border rounded-md"
                placeholder="123 Main Street"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                  placeholder="San Francisco"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">State *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                  className="w-full p-2 border rounded-md"
                  placeholder="CA"
                  maxLength={2}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">ZIP Code *</label>
                <input
                  type="text"
                  value={formData.zip_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                  placeholder="94102"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Dimensions</label>
              <input
                type="text"
                value={formData.dimensions}
                onChange={(e) => setFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                className="w-full p-2 border rounded-md"
                placeholder="e.g., 10x20 feet, fits 2 cars"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Verifying...' : 'Create Listing'}
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>

      {/* Modals */}
      <IDVerificationModal
        open={showIDModal}
        onOpenChange={setShowIDModal}
        trigger="listing_high_value"
        onVerificationComplete={() => {
          setShowIDModal(false);
          createListing();
        }}
      />

      <PaymentSetupModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        onComplete={handlePaymentSetupComplete}
      />
    </>
  );
}
