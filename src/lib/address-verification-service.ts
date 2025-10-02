import { createComponentDebugger } from './debug-utils';

const debug = createComponentDebugger('AddressVerificationService');

/**
 * Address Verification Service
 * 
 * Compares billing address from payment method with listing address
 * to verify legitimacy and prevent fraud.
 */

export interface Address {
  street?: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}

export interface VerificationResult {
  isMatch: boolean;
  confidence: number; // 0-100
  details: {
    streetMatch: boolean;
    cityMatch: boolean;
    stateMatch: boolean;
    zipCodeMatch: boolean;
  };
  suggestion?: string;
  warnings?: string[];
}

class AddressVerificationService {
  /**
   * Normalize address string for comparison
   */
  private normalizeString(str: string): string {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|court|ct)\b/g, '') // Remove common street suffixes
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Calculate string similarity (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = this.normalizeString(str1);
    const s2 = this.normalizeString(str2);
    
    if (s1 === s2) return 1;
    
    // Simple character-based similarity
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(s1, s2);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Verify if two addresses match
   */
  verifyAddressMatch(billingAddress: Address, listingAddress: Address): VerificationResult {
    debug.info('Verifying address match', { billingAddress, listingAddress });

    const warnings: string[] = [];
    const details = {
      streetMatch: false,
      cityMatch: false,
      stateMatch: false,
      zipCodeMatch: false,
    };

    // Check ZIP code (highest priority)
    const zipMatch = billingAddress.zipCode === listingAddress.zipCode;
    details.zipCodeMatch = zipMatch;

    if (!zipMatch) {
      warnings.push('ZIP codes do not match');
    }

    // Check state
    const stateMatch = this.normalizeString(billingAddress.state) === this.normalizeString(listingAddress.state);
    details.stateMatch = stateMatch;

    if (!stateMatch) {
      warnings.push('States do not match');
    }

    // Check city (allow for slight variations)
    const citySimilarity = this.calculateSimilarity(billingAddress.city, listingAddress.city);
    details.cityMatch = citySimilarity >= 0.85;

    if (!details.cityMatch) {
      warnings.push(`Cities do not match closely (${Math.round(citySimilarity * 100)}% similar)`);
    }

    // Check street (if both provided)
    if (billingAddress.street && listingAddress.street) {
      const streetSimilarity = this.calculateSimilarity(billingAddress.street, listingAddress.street);
      details.streetMatch = streetSimilarity >= 0.80;

      if (!details.streetMatch) {
        warnings.push(`Street addresses do not match closely (${Math.round(streetSimilarity * 100)}% similar)`);
      }
    } else {
      details.streetMatch = true; // Don't penalize if street not provided
    }

    // Calculate overall confidence
    let confidence = 0;
    
    // Weighted scoring
    if (details.zipCodeMatch) confidence += 40; // ZIP is most important
    if (details.stateMatch) confidence += 20;
    if (details.cityMatch) confidence += 20;
    if (details.streetMatch) confidence += 20;

    // Determine if it's a match (need at least 60% confidence)
    const isMatch = confidence >= 60;

    // Generate suggestion
    let suggestion: string | undefined;
    if (!isMatch) {
      if (!details.zipCodeMatch) {
        suggestion = 'Verify that your billing ZIP code matches your listing location';
      } else if (!details.stateMatch) {
        suggestion = 'Your billing state does not match your listing state';
      } else if (!details.cityMatch) {
        suggestion = 'Your billing city does not closely match your listing city';
      } else {
        suggestion = 'Your billing address does not closely match your listing address';
      }
    }

    const result: VerificationResult = {
      isMatch,
      confidence,
      details,
      warnings: warnings.length > 0 ? warnings : undefined,
      suggestion,
    };

    debug.info('Address verification result', result);

    return result;
  }

  /**
   * Check if addresses are in the same general area (same ZIP or nearby)
   */
  areAddressesNearby(address1: Address, address2: Address): boolean {
    // Same ZIP code
    if (address1.zipCode === address2.zipCode) return true;

    // Same state and city
    if (
      this.normalizeString(address1.state) === this.normalizeString(address2.state) &&
      this.calculateSimilarity(address1.city, address2.city) >= 0.9
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get a user-friendly verification status message
   */
  getVerificationMessage(result: VerificationResult): {
    title: string;
    description: string;
    variant: 'success' | 'warning' | 'destructive';
  } {
    if (result.isMatch && result.confidence >= 80) {
      return {
        title: '✓ Address Verified',
        description: 'Your billing address matches your listing location',
        variant: 'success',
      };
    } else if (result.isMatch && result.confidence >= 60) {
      return {
        title: '⚠ Partial Match',
        description: result.suggestion || 'Addresses are similar but not identical',
        variant: 'warning',
      };
    } else {
      return {
        title: '✗ Address Mismatch',
        description: result.suggestion || 'Billing and listing addresses do not match',
        variant: 'destructive',
      };
    }
  }
}

export const addressVerificationService = new AddressVerificationService();
