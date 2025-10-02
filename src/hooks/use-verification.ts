import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './use-auth';
import { 
  tieredVerificationService, 
  VerificationStatus, 
  VerificationTier,
  ListingVerificationResult 
} from '@/lib/tiered-verification-service';

export function useVerification() {
  const { user } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load verification status
  const loadVerificationStatus = useCallback(async () => {
    if (!user) {
      setVerificationStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const status = await tieredVerificationService.getUserVerificationStatus(user.id);
      setVerificationStatus(status);
    } catch (err: any) {
      setError(err.message || 'Failed to load verification status');
      console.error('Verification status error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check if user can create a listing
  const canCreateListing = useCallback(async (
    listingData: {
      price_per_day?: number;
      price_per_hour: number;
      address: string;
      city: string;
      state: string;
      zip_code: string;
    }
  ): Promise<ListingVerificationResult> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      return await tieredVerificationService.canCreateListing(user.id, listingData);
    } catch (err: any) {
      console.error('Listing verification error:', err);
      throw err;
    }
  }, [user]);

  // Upgrade to verified host
  const upgradeToVerifiedHost = useCallback(async (): Promise<boolean> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const success = await tieredVerificationService.upgradeToVerifiedHost(user.id);
      if (success) {
        // Refresh status after upgrade
        await loadVerificationStatus();
      }
      return success;
    } catch (err: any) {
      console.error('Verified host upgrade error:', err);
      throw err;
    }
  }, [user, loadVerificationStatus]);

  // Get tier requirements
  const getTierRequirements = useCallback((tier: VerificationTier) => {
    return tieredVerificationService.getTierRequirements(tier);
  }, []);

  // Check if user has specific capability
  const hasCapability = useCallback((capability: keyof VerificationStatus['requirements']): boolean => {
    if (!verificationStatus) return false;
    return verificationStatus.requirements[capability];
  }, [verificationStatus]);

  // Check if user can access high-value features
  const canAccessHighValueFeatures = useCallback((): boolean => {
    return verificationStatus?.canCreateHighValueListings || false;
  }, [verificationStatus]);

  // Check if user can book without restrictions
  const canBookWithoutRestrictions = useCallback((): boolean => {
    return verificationStatus?.canBookWithoutRestrictions || false;
  }, [verificationStatus]);

  // Get next verification steps
  const getNextSteps = useCallback((): string[] => {
    return verificationStatus?.nextSteps || [];
  }, [verificationStatus]);

  // Check if user is at a specific tier or higher
  const isAtTierOrHigher = useCallback((targetTier: VerificationTier): boolean => {
    if (!verificationStatus) return false;

    const tierOrder: VerificationTier[] = ['basic', 'payment_verified', 'id_verified', 'premium_verified'];
    const currentIndex = tierOrder.indexOf(verificationStatus.tier);
    const targetIndex = tierOrder.indexOf(targetTier);

    return currentIndex >= targetIndex;
  }, [verificationStatus]);

  // Get verification score percentage
  const getScorePercentage = useCallback((): number => {
    return verificationStatus?.score || 0;
  }, [verificationStatus]);

  // Get earned badges
  const getEarnedBadges = useCallback((): string[] => {
    return verificationStatus?.badges || [];
  }, [verificationStatus]);

  // Refresh verification status
  const refresh = useCallback(() => {
    return loadVerificationStatus();
  }, [loadVerificationStatus]);

  // Load status on mount and when user changes
  useEffect(() => {
    loadVerificationStatus();
  }, [loadVerificationStatus]);

  return {
    // State
    verificationStatus,
    loading,
    error,

    // Actions
    refresh,
    canCreateListing,
    upgradeToVerifiedHost,

    // Computed values
    hasCapability,
    canAccessHighValueFeatures,
    canBookWithoutRestrictions,
    getNextSteps,
    isAtTierOrHigher,
    getScorePercentage,
    getEarnedBadges,
    getTierRequirements,

    // Convenience getters
    tier: verificationStatus?.tier || 'basic',
    score: verificationStatus?.score || 0,
    badges: verificationStatus?.badges || [],
    requirements: verificationStatus?.requirements || {
      paymentSetup: false,
      addressVerified: false,
      idVerified: false,
      verifiedHostBadge: false,
    },
  };
}
