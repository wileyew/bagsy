import { supabase } from '@/integrations/supabase/client';
import { createComponentDebugger } from './debug-utils';

const debug = createComponentDebugger('FlaggingService');

export type FlagType = 
  | 'fake_listing'
  | 'fake_photos'
  | 'wrong_address'
  | 'unsafe_space'
  | 'price_scam'
  | 'unverified_owner'
  | 'spam'
  | 'other';

export type FlagStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface ListingFlag {
  id: string;
  spaceId: string;
  flaggerUserId: string | null;
  flagType: FlagType;
  flagReason: string;
  autoFlagged: boolean;
  confidenceScore: number | null;
  status: FlagStatus;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutoFlagCriteria {
  lowAddressConfidence: boolean;      // Address verification < 50%
  noDriverLicense: boolean;            // No license uploaded
  suspiciousPhotos: boolean;           // AI photo analysis flags issues
  abnormalPricing: boolean;            // Price way above/below market
  newAccountHighValue: boolean;        // New account with expensive listing
  rapidListings: boolean;              // Multiple listings in short time
}

class FlaggingService {
  /**
   * User reports a suspicious listing
   */
  async reportListing(
    spaceId: string,
    flagType: FlagType,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      debug.info('User reporting listing', { spaceId, flagType });

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { success: false, error: 'Must be logged in to report' };
      }

      // Check if user already flagged this listing
      const { data: existing } = await supabase
        .from('listing_flags')
        .select('id')
        .eq('space_id', spaceId)
        .eq('flagger_user_id', user.user.id)
        .eq('status', 'pending')
        .single();

      if (existing) {
        return { success: false, error: 'You have already reported this listing' };
      }

      // Create the flag
      const { error } = await supabase
        .from('listing_flags')
        .insert({
          space_id: spaceId,
          flagger_user_id: user.user.id,
          flag_type: flagType,
          flag_reason: reason,
          auto_flagged: false,
          status: 'pending'
        });

      if (error) throw error;

      debug.info('Listing reported successfully', { spaceId });
      return { success: true };
    } catch (error) {
      debug.error('Failed to report listing', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to report listing' 
      };
    }
  }

  /**
   * Automatically flag a listing based on criteria
   */
  async autoFlagListing(
    spaceId: string,
    criteria: AutoFlagCriteria,
    confidenceScore: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      debug.info('Auto-flagging listing', { spaceId, criteria, confidenceScore });

      // Determine flag type based on criteria
      let flagType: FlagType = 'other';
      let reason = 'Automatically flagged by system: ';

      if (criteria.lowAddressConfidence) {
        flagType = 'wrong_address';
        reason += 'Address verification failed (low confidence score). ';
      }
      if (criteria.noDriverLicense) {
        flagType = 'unverified_owner';
        reason += 'Owner has not uploaded driver\'s license. ';
      }
      if (criteria.suspiciousPhotos) {
        flagType = 'fake_photos';
        reason += 'Photos appear suspicious or manipulated. ';
      }
      if (criteria.abnormalPricing) {
        flagType = 'price_scam';
        reason += 'Pricing is significantly outside normal range. ';
      }
      if (criteria.newAccountHighValue) {
        flagType = 'fake_listing';
        reason += 'New account with high-value listing. ';
      }
      if (criteria.rapidListings) {
        flagType = 'spam';
        reason += 'Multiple listings created in short time. ';
      }

      // Create auto-flag using service role (bypasses RLS)
      const { error } = await supabase
        .from('listing_flags')
        .insert({
          space_id: spaceId,
          flagger_user_id: null, // System flag
          flag_type: flagType,
          flag_reason: reason.trim(),
          auto_flagged: true,
          confidence_score: confidenceScore,
          status: 'pending'
        });

      if (error) throw error;

      debug.info('Listing auto-flagged successfully', { spaceId, flagType });
      return { success: true };
    } catch (error) {
      debug.error('Failed to auto-flag listing', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to auto-flag listing' 
      };
    }
  }

  /**
   * Check if a listing should be auto-flagged
   */
  async checkListingForAutoFlag(spaceId: string, ownerId: string): Promise<void> {
    try {
      debug.info('Checking listing for auto-flag', { spaceId, ownerId });

      const criteria: AutoFlagCriteria = {
        lowAddressConfidence: false,
        noDriverLicense: false,
        suspiciousPhotos: false,
        abnormalPricing: false,
        newAccountHighValue: false,
        rapidListings: false
      };

      let totalScore = 100; // Start with perfect score

      // Check 1: Driver's license verification
      const { data: profile } = await supabase
        .from('profiles')
        .select('driver_license_url, driver_license_verification_confidence')
        .eq('user_id', ownerId)
        .single();

      if (!profile?.driver_license_url) {
        criteria.noDriverLicense = true;
        totalScore -= 30;
      } else if (profile.driver_license_verification_confidence && profile.driver_license_verification_confidence < 50) {
        criteria.lowAddressConfidence = true;
        totalScore -= 40;
      }

      // Check 2: Account age and listing value
      const { data: space } = await supabase
        .from('spaces')
        .select('price_per_hour, price_per_day, created_at')
        .eq('id', spaceId)
        .single();

      if (space) {
        const hourlyPrice = space.price_per_hour || 0;
        const dailyPrice = space.price_per_day || hourlyPrice * 24;

        // New account with high-value listing
        const accountAge = Date.now() - new Date(profile?.created_at || 0).getTime();
        const isNewAccount = accountAge < 7 * 24 * 60 * 60 * 1000; // 7 days

        if (isNewAccount && dailyPrice > 200) {
          criteria.newAccountHighValue = true;
          totalScore -= 20;
        }

        // Abnormal pricing (too high)
        if (hourlyPrice > 100 || dailyPrice > 500) {
          criteria.abnormalPricing = true;
          totalScore -= 15;
        }
      }

      // Check 3: Rapid listings
      const { count } = await supabase
        .from('spaces')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (count && count > 5) {
        criteria.rapidListings = true;
        totalScore -= 15;
      }

      // Auto-flag if score is below threshold
      if (totalScore < 60) {
        await this.autoFlagListing(spaceId, criteria, totalScore);
      }

      debug.info('Listing check complete', { spaceId, score: totalScore, willFlag: totalScore < 60 });
    } catch (error) {
      debug.error('Failed to check listing for auto-flag', error);
    }
  }

  /**
   * Get all flags for a listing
   */
  async getListingFlags(spaceId: string): Promise<ListingFlag[]> {
    try {
      const { data, error } = await supabase
        .from('listing_flags')
        .select('*')
        .eq('space_id', spaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(flag => ({
        id: flag.id,
        spaceId: flag.space_id,
        flaggerUserId: flag.flagger_user_id,
        flagType: flag.flag_type as FlagType,
        flagReason: flag.flag_reason,
        autoFlagged: flag.auto_flagged,
        confidenceScore: flag.confidence_score,
        status: flag.status as FlagStatus,
        adminNotes: flag.admin_notes,
        reviewedBy: flag.reviewed_by,
        reviewedAt: flag.reviewed_at,
        createdAt: flag.created_at,
        updatedAt: flag.updated_at
      }));
    } catch (error) {
      debug.error('Failed to get listing flags', error);
      return [];
    }
  }

  /**
   * Get all flagged listings (for admin dashboard)
   */
  async getFlaggedListings(status: FlagStatus = 'pending'): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('listing_flags')
        .select(`
          *,
          space:spaces(
            id,
            title,
            address,
            price_per_hour,
            owner_id,
            flag_count,
            is_active
          )
        `)
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      debug.error('Failed to get flagged listings', error);
      return [];
    }
  }

  /**
   * Update flag status (admin only)
   */
  async updateFlagStatus(
    flagId: string,
    status: FlagStatus,
    adminNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        return { success: false, error: 'Must be logged in' };
      }

      const { error } = await supabase
        .from('listing_flags')
        .update({
          status,
          admin_notes: adminNotes,
          reviewed_by: user.user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', flagId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      debug.error('Failed to update flag status', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update flag' 
      };
    }
  }

  /**
   * Dismiss all flags for a listing (when owner fixes issues)
   */
  async dismissAllFlags(spaceId: string, adminNotes: string): Promise<{ success: boolean }> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return { success: false };

      const { error } = await supabase
        .from('listing_flags')
        .update({
          status: 'dismissed',
          admin_notes: adminNotes,
          reviewed_by: user.user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('space_id', spaceId)
        .in('status', ['pending', 'reviewing']);

      if (error) throw error;

      // Update space to remove flag
      await supabase
        .from('spaces')
        .update({
          is_flagged: false,
          flag_count: 0
        })
        .eq('id', spaceId);

      return { success: true };
    } catch (error) {
      debug.error('Failed to dismiss flags', error);
      return { success: false };
    }
  }
}

export const flaggingService = new FlaggingService();

