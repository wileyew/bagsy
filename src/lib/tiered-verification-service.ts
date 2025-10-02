import { createComponentDebugger } from './debug-utils';
import { supabase } from '@/integrations/supabase/client';
import { addressVerificationService, Address } from './address-verification-service';
import { stripePaymentService } from './stripe-payment-service';

const debug = createComponentDebugger('TieredVerificationService');

/**
 * Tiered Verification Service
 * 
 * Implements the tiered verification strategy:
 * - Basic: New user, no verification
 * - Payment Verified: Payment method + address verification
 * - ID Verified: Government ID verification
 * - Premium Verified: Full verification with premium features
 */

export type VerificationTier = 'basic' | 'payment_verified' | 'id_verified' | 'premium_verified';

export interface VerificationStatus {
  tier: VerificationTier;
  score: number;
  badges: string[];
  canCreateHighValueListings: boolean;
  canBookWithoutRestrictions: boolean;
  requirements: {
    paymentSetup: boolean;
    addressVerified: boolean;
    idVerified: boolean;
    verifiedHostBadge: boolean;
  };
  nextSteps: string[];
}

export interface VerificationSettings {
  tierThresholds: {
    basic: { min: number; max: number };
    payment_verified: { min: number; max: number };
    id_verified: { min: number; max: number };
    premium_verified: { min: number; max: number };
  };
  highValueThreshold: number;
  addressMatchThresholds: {
    verified: { min: number; autoApprove: boolean };
    reviewRequired: { min: number; max: number; autoApprove: boolean };
    mismatch: { max: number; autoApprove: boolean; requireId: boolean };
  };
}

export interface ListingVerificationResult {
  canCreate: boolean;
  requiresVerification: boolean;
  tierRequired: VerificationTier;
  reason?: string;
  suggestions: string[];
}

class TieredVerificationService {
  private settings: VerificationSettings | null = null;

  constructor() {
    this.loadSettings();
  }

  /**
   * Load verification settings from database
   */
  private async loadSettings(): Promise<void> {
    try {
      const { data } = await supabase
        .from('verification_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['tier_thresholds', 'high_value_threshold', 'address_match_thresholds']);

      if (data) {
        const settings: any = {};
        data.forEach(setting => {
          settings[setting.setting_key] = setting.setting_value;
        });

        this.settings = {
          tierThresholds: settings.tier_thresholds || {
            basic: { min: 0, max: 39 },
            payment_verified: { min: 40, max: 69 },
            id_verified: { min: 70, max: 89 },
            premium_verified: { min: 90, max: 100 }
          },
          highValueThreshold: settings.high_value_threshold || 100,
          addressMatchThresholds: settings.address_match_thresholds || {
            verified: { min: 80, autoApprove: true },
            reviewRequired: { min: 60, max: 79, autoApprove: false },
            mismatch: { max: 59, autoApprove: false, requireId: true }
          }
        };
      }
    } catch (error) {
      debug.error('Failed to load verification settings', error);
      // Use default settings
      this.settings = {
        tierThresholds: {
          basic: { min: 0, max: 39 },
          payment_verified: { min: 40, max: 69 },
          id_verified: { min: 70, max: 89 },
          premium_verified: { min: 90, max: 100 }
        },
        highValueThreshold: 100,
        addressMatchThresholds: {
          verified: { min: 80, autoApprove: true },
          reviewRequired: { min: 60, max: 79, autoApprove: false },
          mismatch: { max: 59, autoApprove: false, requireId: true }
        }
      };
    }
  }

  /**
   * Get user's current verification status
   */
  async getUserVerificationStatus(userId: string): Promise<VerificationStatus> {
    try {
      debug.info('Getting verification status', { userId });

      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          verification_tier,
          verification_score,
          verified_host_badge,
          payment_method_setup,
          address_verification_status,
          address_verification_confidence,
          driver_license_verified,
          verification_badges,
          fraud_flags,
          high_value_listing_access
        `)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const tier = profile?.verification_tier || 'basic';
      const score = profile?.verification_score || 0;
      const badges = profile?.verification_badges ? JSON.parse(profile.verification_badges) : [];

      const requirements = {
        paymentSetup: profile?.payment_method_setup || false,
        addressVerified: profile?.address_verification_status === 'verified',
        idVerified: profile?.driver_license_verified === true,
        verifiedHostBadge: profile?.verified_host_badge || false,
      };

      const nextSteps = this.getNextSteps(tier, requirements);

      return {
        tier,
        score,
        badges,
        canCreateHighValueListings: profile?.high_value_listing_access || false,
        canBookWithoutRestrictions: tier !== 'basic',
        requirements,
        nextSteps,
      };
    } catch (error) {
      debug.error('Failed to get verification status', error);
      return {
        tier: 'basic',
        score: 0,
        badges: [],
        canCreateHighValueListings: false,
        canBookWithoutRestrictions: false,
        requirements: {
          paymentSetup: false,
          addressVerified: false,
          idVerified: false,
          verifiedHostBadge: false,
        },
        nextSteps: ['Complete payment setup', 'Verify your address'],
      };
    }
  }

  /**
   * Verify user's address against listing address
   */
  async verifyUserAddress(userId: string, listingAddress: Address): Promise<{
    success: boolean;
    confidence: number;
    status: 'verified' | 'review_required' | 'mismatch';
    message: string;
    requiresIdVerification: boolean;
  }> {
    try {
      debug.info('Verifying user address', { userId });

      // Check if user has payment setup
      const hasPaymentSetup = await stripePaymentService.hasPaymentSetup(userId);
      if (!hasPaymentSetup) {
        return {
          success: false,
          confidence: 0,
          status: 'mismatch',
          message: 'Payment method setup required for address verification',
          requiresIdVerification: false,
        };
      }

      // Get user's billing address from Stripe (you'd implement this)
      // For now, we'll get it from the profile or simulate it
      const billingAddress = await this.getBillingAddress(userId);
      if (!billingAddress) {
        return {
          success: false,
          confidence: 0,
          status: 'mismatch',
          message: 'Could not retrieve billing address',
          requiresIdVerification: false,
        };
      }

      // Verify address match
      const result = addressVerificationService.verifyAddressMatch(
        billingAddress,
        listingAddress
      );

      // Update profile with verification result
      await supabase
        .from('profiles')
        .update({
          address_verification_status: result.isMatch ? 'verified' : 
                                     result.confidence >= 60 ? 'requires_review' : 'mismatch',
          address_verification_confidence: result.confidence,
          last_verification_check: new Date().toISOString(),
        })
        .eq('user_id', userId);

      // Log verification event
      await this.logVerificationEvent(userId, 'address_verification', {
        confidence: result.confidence,
        isMatch: result.isMatch,
        billingAddress,
        listingAddress,
      });

      // Determine status based on confidence
      let status: 'verified' | 'review_required' | 'mismatch';
      let requiresIdVerification = false;

      if (result.confidence >= 80) {
        status = 'verified';
      } else if (result.confidence >= 60) {
        status = 'review_required';
      } else {
        status = 'mismatch';
        requiresIdVerification = true;
      }

      const message = this.getVerificationMessage(result);

      return {
        success: result.isMatch,
        confidence: result.confidence,
        status,
        message,
        requiresIdVerification,
      };
    } catch (error) {
      debug.error('Failed to verify address', error);
      return {
        success: false,
        confidence: 0,
        status: 'mismatch',
        message: 'Address verification failed',
        requiresIdVerification: true,
      };
    }
  }

  /**
   * Check if user can create a listing
   */
  async canCreateListing(
    userId: string, 
    listingData: { 
      price_per_day?: number; 
      price_per_hour: number; 
      address: string;
      city: string;
      state: string;
      zip_code: string;
    }
  ): Promise<ListingVerificationResult> {
    try {
      debug.info('Checking listing creation permissions', { userId });

      const verificationStatus = await this.getUserVerificationStatus(userId);
      const isHighValue = this.isHighValueListing(listingData.price_per_day || listingData.price_per_hour * 24);

      // Parse listing address
      const listingAddress: Address = {
        street: listingData.address,
        city: listingData.city,
        state: listingData.state,
        zipCode: listingData.zip_code,
      };

      // Check address verification
      const addressVerification = await this.verifyUserAddress(userId, listingAddress);

      // Determine requirements
      let canCreate = true;
      let requiresVerification = false;
      let tierRequired: VerificationTier = 'basic';
      const suggestions: string[] = [];

      if (isHighValue) {
        if (!verificationStatus.canCreateHighValueListings) {
          canCreate = false;
          requiresVerification = true;
          tierRequired = 'id_verified';
          suggestions.push('Upgrade to ID verification to list high-value spaces');
        }
      }

      if (addressVerification.status === 'mismatch') {
        if (isHighValue) {
          canCreate = false;
          suggestions.push('Address mismatch detected. ID verification required for high-value listings.');
        } else {
          suggestions.push('Address mismatch detected. Consider verifying your ID for better approval rates.');
        }
      }

      if (addressVerification.status === 'review_required') {
        suggestions.push('Your listing will be reviewed due to address differences.');
      }

      // Add tier-specific suggestions
      if (verificationStatus.tier === 'basic') {
        suggestions.push('Complete payment setup to improve your verification status');
      } else if (verificationStatus.tier === 'payment_verified' && isHighValue) {
        suggestions.push('Consider ID verification to unlock high-value listing features');
      }

      return {
        canCreate,
        requiresVerification,
        tierRequired,
        reason: !canCreate ? 'Insufficient verification level' : undefined,
        suggestions,
      };
    } catch (error) {
      debug.error('Failed to check listing creation permissions', error);
      return {
        canCreate: false,
        requiresVerification: true,
        tierRequired: 'basic',
        reason: 'Verification check failed',
        suggestions: ['Please try again or contact support'],
      };
    }
  }

  /**
   * Upgrade user to verified host badge
   */
  async upgradeToVerifiedHost(userId: string): Promise<boolean> {
    try {
      debug.info('Upgrading to verified host', { userId });

      const verificationStatus = await this.getUserVerificationStatus(userId);

      // Check if user qualifies for verified host badge
      if (verificationStatus.tier !== 'id_verified' && verificationStatus.tier !== 'premium_verified') {
        throw new Error('ID verification required for verified host badge');
      }

      // Update profile
      const { error } = await supabase
        .from('profiles')
        .update({
          verified_host_badge: true,
          verification_badges: JSON.stringify([
            ...verificationStatus.badges.filter((b: string) => b !== 'verified_host'),
            'verified_host'
          ]),
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Log event
      await this.logVerificationEvent(userId, 'tier_upgrade', {
        previousTier: verificationStatus.tier,
        newTier: 'premium_verified',
        badge: 'verified_host',
      });

      debug.info('Successfully upgraded to verified host', { userId });
      return true;
    } catch (error) {
      debug.error('Failed to upgrade to verified host', error);
      return false;
    }
  }

  /**
   * Get billing address for user (placeholder - implement with Stripe API)
   */
  private async getBillingAddress(userId: string): Promise<Address | null> {
    // This would normally call Stripe API to get customer billing address
    // For now, return a mock address
    return {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94102',
    };
  }

  /**
   * Check if listing is high-value
   */
  private isHighValueListing(dailyPrice: number): boolean {
    const threshold = this.settings?.highValueThreshold || 100;
    return dailyPrice > threshold;
  }

  /**
   * Get next steps for user to improve verification
   */
  private getNextSteps(tier: VerificationTier, requirements: any): string[] {
    const steps: string[] = [];

    if (!requirements.paymentSetup) {
      steps.push('Set up payment method');
    }

    if (requirements.paymentSetup && !requirements.addressVerified) {
      steps.push('Verify your billing address');
    }

    if (tier === 'basic' || tier === 'payment_verified') {
      steps.push('Complete ID verification for premium features');
    }

    if (tier === 'id_verified' && !requirements.verifiedHostBadge) {
      steps.push('Apply for verified host badge');
    }

    return steps;
  }

  /**
   * Get user-friendly verification message
   */
  private getVerificationMessage(result: any): string {
    if (result.confidence >= 80) {
      return 'Address verified successfully';
    } else if (result.confidence >= 60) {
      return 'Address partially matches - review may be required';
    } else {
      return 'Address mismatch detected - additional verification required';
    }
  }

  /**
   * Log verification event
   */
  private async logVerificationEvent(
    userId: string, 
    eventType: string, 
    details: any
  ): Promise<void> {
    try {
      await supabase
        .from('verification_audit_log')
        .insert({
          user_id: userId,
          event_type: eventType,
          details,
        });
    } catch (error) {
      debug.error('Failed to log verification event', error);
    }
  }

  /**
   * Get verification requirements for a specific tier
   */
  getTierRequirements(tier: VerificationTier): {
    name: string;
    description: string;
    benefits: string[];
    requirements: string[];
  } {
    const tierInfo = {
      basic: {
        name: 'Basic',
        description: 'New user with minimal verification',
        benefits: [
          'Can make bookings',
          'Can list basic spaces',
        ],
        requirements: [
          'User account created',
        ],
      },
      payment_verified: {
        name: 'Payment Verified',
        description: 'Payment method verified with address check',
        benefits: [
          'All Basic benefits',
          'Faster booking approval',
          'Address verification',
        ],
        requirements: [
          'Payment method set up',
          'Billing address verified',
        ],
      },
      id_verified: {
        name: 'ID Verified',
        description: 'Government ID verified for enhanced trust',
        benefits: [
          'All Payment Verified benefits',
          'High-value listing access',
          'Priority customer support',
          'Lower booking fees',
        ],
        requirements: [
          'All Payment Verified requirements',
          'Government ID verification',
        ],
      },
      premium_verified: {
        name: 'Premium Verified',
        description: 'Full verification with premium features',
        benefits: [
          'All ID Verified benefits',
          'Verified Host badge',
          'Premium listing features',
          'Highest search ranking',
        ],
        requirements: [
          'All ID Verified requirements',
          'Verified Host application approved',
        ],
      },
    };

    return tierInfo[tier];
  }
}

export const tieredVerificationService = new TieredVerificationService();
