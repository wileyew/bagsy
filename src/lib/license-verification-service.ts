import { openaiRequestManager } from './openai-request-manager';
import { createComponentDebugger } from './debug-utils';

const debug = createComponentDebugger('LicenseVerificationService');

export interface ExtractedLicenseInfo {
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  fullAddress: string | null;
  name: string | null;
  licenseNumber: string | null;
  expirationDate: string | null;
  dateOfBirth: string | null;
  extractedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AddressVerificationResult {
  isMatch: boolean;
  confidence: number;
  extractedAddress: string | null;
  providedAddress: string;
  matchDetails: {
    streetMatch: boolean;
    cityMatch: boolean;
    stateMatch: boolean;
    zipMatch: boolean;
  };
  warnings: string[];
  suggestions: string[];
}

class LicenseVerificationService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    if (!this.apiKey) {
      debug.warn('OpenAI API key not found for license verification');
    }
  }

  /**
   * Extract information from driver's license image using OpenAI Vision
   */
  async extractLicenseInfo(imageUrl: string): Promise<ExtractedLicenseInfo> {
    try {
      debug.info('Extracting license info from image', { imageUrl: imageUrl.substring(0, 50) + '...' });

      const response = await openaiRequestManager.makeRequest(
        'POST',
        '/chat/completions',
        {
          model: 'gpt-4o-mini', // Using mini for cost efficiency, upgrade to gpt-4o for better accuracy
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Analyze this driver's license image and extract the following information in JSON format:
{
  "address": "street address only",
  "city": "city name",
  "state": "state or province",
  "zipCode": "ZIP or postal code",
  "fullAddress": "complete address as it appears",
  "name": "full name",
  "licenseNumber": "license number",
  "expirationDate": "expiration date",
  "dateOfBirth": "date of birth",
  "confidence": "high/medium/low based on image quality and readability"
}

Important:
- Extract ONLY what you can read clearly
- Use null for any field you cannot read confidently
- Be very careful with the address - it's critical for verification
- The confidence should be "high" only if all address fields are clearly readable`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: imageUrl,
                    detail: 'high' // High detail for better text extraction
                  }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1 // Low temperature for factual extraction
        }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI Vision API');
      }

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from response');
      }

      const extracted = JSON.parse(jsonMatch[0]);
      
      const result: ExtractedLicenseInfo = {
        address: extracted.address || null,
        city: extracted.city || null,
        state: extracted.state || null,
        zipCode: extracted.zipCode || null,
        fullAddress: extracted.fullAddress || null,
        name: extracted.name || null,
        licenseNumber: extracted.licenseNumber || null,
        expirationDate: extracted.expirationDate || null,
        dateOfBirth: extracted.dateOfBirth || null,
        extractedAt: new Date().toISOString(),
        confidence: extracted.confidence || 'low'
      };

      debug.info('License info extracted successfully', {
        hasAddress: !!result.address,
        hasCity: !!result.city,
        hasZip: !!result.zipCode,
        confidence: result.confidence
      });

      return result;
    } catch (error) {
      debug.error('Failed to extract license info', error);
      throw error;
    }
  }

  /**
   * Verify if the license address matches the provided listing address
   */
  async verifyAddress(
    licenseAddress: ExtractedLicenseInfo,
    providedAddress: string,
    providedZipCode?: string
  ): Promise<AddressVerificationResult> {
    try {
      debug.info('Verifying address match', {
        extractedAddress: licenseAddress.fullAddress,
        providedAddress,
        providedZipCode
      });

      // If extraction failed, return unverified
      if (!licenseAddress.address && !licenseAddress.fullAddress) {
        return {
          isMatch: false,
          confidence: 0,
          extractedAddress: null,
          providedAddress,
          matchDetails: {
            streetMatch: false,
            cityMatch: false,
            stateMatch: false,
            zipMatch: false
          },
          warnings: ['Could not extract address from driver\'s license'],
          suggestions: ['Please ensure the image is clear and all text is readable', 'Try uploading a higher quality photo']
        };
      }

      // Normalize addresses for comparison
      const normalizeAddress = (addr: string) => {
        return addr
          .toLowerCase()
          .replace(/\./g, '')
          .replace(/,/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const normalizedExtracted = normalizeAddress(licenseAddress.fullAddress || '');
      const normalizedProvided = normalizeAddress(providedAddress);

      // Check individual components
      const streetMatch = licenseAddress.address 
        ? normalizedProvided.includes(normalizeAddress(licenseAddress.address))
        : false;

      const cityMatch = licenseAddress.city
        ? normalizedProvided.includes(normalizeAddress(licenseAddress.city))
        : false;

      const stateMatch = licenseAddress.state
        ? normalizedProvided.includes(normalizeAddress(licenseAddress.state))
        : false;

      const zipMatch = licenseAddress.zipCode && providedZipCode
        ? licenseAddress.zipCode.replace(/\D/g, '') === providedZipCode.replace(/\D/g, '')
        : false;

      // Calculate confidence score
      let matchCount = 0;
      let totalChecks = 0;

      if (licenseAddress.address) {
        totalChecks++;
        if (streetMatch) matchCount++;
      }
      if (licenseAddress.city) {
        totalChecks++;
        if (cityMatch) matchCount++;
      }
      if (licenseAddress.state) {
        totalChecks++;
        if (stateMatch) matchCount++;
      }
      if (licenseAddress.zipCode && providedZipCode) {
        totalChecks++;
        if (zipMatch) matchCount++;
      }

      const confidence = totalChecks > 0 ? (matchCount / totalChecks) * 100 : 0;
      const isMatch = confidence >= 75; // Consider it a match if 75% or more components match

      // Generate warnings and suggestions
      const warnings: string[] = [];
      const suggestions: string[] = [];

      if (!isMatch) {
        warnings.push('The address on your driver\'s license does not match the listing address');
        
        if (!streetMatch && licenseAddress.address) {
          warnings.push(`License street: ${licenseAddress.address}`);
        }
        if (!cityMatch && licenseAddress.city) {
          warnings.push(`License city: ${licenseAddress.city}`);
        }
        if (!zipMatch && licenseAddress.zipCode) {
          warnings.push(`License ZIP: ${licenseAddress.zipCode}`);
        }

        suggestions.push('Verify that you are listing a space at your registered address');
        suggestions.push('If you recently moved, you may need to update your driver\'s license');
        suggestions.push('You can still list the space, but it may require additional verification');
      }

      if (licenseAddress.confidence === 'low') {
        warnings.push('The image quality is low - verification may not be accurate');
        suggestions.push('Consider uploading a clearer photo of your driver\'s license');
      }

      const result: AddressVerificationResult = {
        isMatch,
        confidence,
        extractedAddress: licenseAddress.fullAddress,
        providedAddress,
        matchDetails: {
          streetMatch,
          cityMatch,
          stateMatch,
          zipMatch
        },
        warnings,
        suggestions
      };

      debug.info('Address verification complete', {
        isMatch,
        confidence,
        matchDetails: result.matchDetails
      });

      return result;
    } catch (error) {
      debug.error('Address verification failed', error);
      throw error;
    }
  }

  /**
   * Check if the driver's license is expired
   */
  isLicenseExpired(expirationDate: string | null): boolean {
    if (!expirationDate) return false;

    try {
      const expDate = new Date(expirationDate);
      const today = new Date();
      return expDate < today;
    } catch {
      return false;
    }
  }

  /**
   * Complete verification workflow
   */
  async verifyLicense(
    imageUrl: string,
    listingAddress: string,
    listingZipCode?: string
  ): Promise<{
    extracted: ExtractedLicenseInfo;
    verification: AddressVerificationResult;
    isExpired: boolean;
    overallStatus: 'verified' | 'needs_review' | 'failed';
  }> {
    try {
      // Extract license information
      const extracted = await this.extractLicenseInfo(imageUrl);

      // Verify address
      const verification = await this.verifyAddress(extracted, listingAddress, listingZipCode);

      // Check expiration
      const isExpired = this.isLicenseExpired(extracted.expirationDate);

      // Determine overall status
      let overallStatus: 'verified' | 'needs_review' | 'failed';
      
      if (isExpired) {
        overallStatus = 'failed';
      } else if (verification.isMatch && verification.confidence >= 90) {
        overallStatus = 'verified';
      } else if (verification.confidence >= 50) {
        overallStatus = 'needs_review';
      } else {
        overallStatus = 'failed';
      }

      debug.info('License verification workflow complete', {
        overallStatus,
        isExpired,
        addressMatch: verification.isMatch,
        confidence: verification.confidence
      });

      return {
        extracted,
        verification,
        isExpired,
        overallStatus
      };
    } catch (error) {
      debug.error('License verification workflow failed', error);
      throw error;
    }
  }
}

export const licenseVerificationService = new LicenseVerificationService();

