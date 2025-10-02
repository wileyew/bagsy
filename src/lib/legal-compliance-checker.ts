import { createComponentDebugger } from './debug-utils';
import { openaiRequestManager } from './openai-request-manager';

const debug = createComponentDebugger('LegalComplianceChecker');

export interface LegalComplianceResult {
  isAllowed: boolean;
  certainty: 'high' | 'medium' | 'low' | 'unknown';
  state: string;
  city: string;
  zipCode: string;
  restrictions: {
    stateLevel: {
      allowed: boolean;
      restrictions: string[];
      notes: string;
    };
    cityLevel: {
      allowed: boolean;
      restrictions: string[];
      notes: string;
    };
    zoningLevel: {
      allowed: boolean;
      restrictions: string[];
      notes: string;
    };
  };
  warnings: string[];
  requirements: string[];
  recommendations: string[];
  sources: string[];
  checkedAt: string;
}

// Known state regulations (manually curated database)
const STATE_REGULATIONS: Record<string, {
  allowed: boolean;
  restrictions: string[];
  notes: string;
  requiresPermit: boolean;
  maxDuration?: string;
  taxImplications?: string;
}> = {
  'CA': { // California
    allowed: true,
    restrictions: [
      'Must comply with local zoning ordinances',
      'HOA restrictions may apply',
      'May need business license for commercial use',
      'Short-term rentals (<30 days) may require permits in some cities'
    ],
    notes: 'California generally allows driveway/parking space rentals, but local regulations vary significantly by city.',
    requiresPermit: false,
    taxImplications: 'Income must be reported on state tax return'
  },
  'NY': { // New York
    allowed: true,
    restrictions: [
      'NYC has specific parking space rental regulations',
      'Must comply with Certificate of Occupancy',
      'Commercial use may require business license'
    ],
    notes: 'Generally allowed but heavily regulated in NYC.',
    requiresPermit: false
  },
  'TX': { // Texas
    allowed: true,
    restrictions: [
      'Very few restrictions',
      'HOA rules may apply',
      'Commercial use may need business registration'
    ],
    notes: 'Texas has minimal restrictions on private property rentals.',
    requiresPermit: false
  },
  'FL': { // Florida
    allowed: true,
    restrictions: [
      'Local zoning ordinances apply',
      'Homestead exemptions may be affected',
      'HOA restrictions common'
    ],
    notes: 'Generally permissive, but check local zoning.',
    requiresPermit: false
  },
  'IL': { // Illinois
    allowed: true,
    restrictions: [
      'Chicago has specific parking regulations',
      'May need business license for regular rentals'
    ],
    notes: 'Allowed with standard business compliance.',
    requiresPermit: false
  }
};

// City-specific regulations
const CITY_REGULATIONS: Record<string, {
  allowed: boolean;
  restrictions: string[];
  requiresPermit: boolean;
  permitUrl?: string;
}> = {
  'San Francisco, CA': {
    allowed: true,
    restrictions: [
      'Short-term rentals require registration',
      'Business license may be required',
      'Cannot violate residential parking permits',
      'HOA restrictions often apply'
    ],
    requiresPermit: true,
    permitUrl: 'https://sf.gov/short-term-residential-rentals'
  },
  'Los Angeles, CA': {
    allowed: true,
    restrictions: [
      'Home-Sharing Ordinance applies',
      'Registration required for short-term rentals',
      'Parking space rentals generally allowed'
    ],
    requiresPermit: true,
    permitUrl: 'https://planning.lacity.org/homestay'
  },
  'New York, NY': {
    allowed: true,
    restrictions: [
      'Must comply with Certificate of Occupancy',
      'Short-term rentals (<30 days) heavily regulated',
      'Parking space rentals separate from dwelling units allowed'
    ],
    requiresPermit: false
  },
  'Chicago, IL': {
    allowed: true,
    restrictions: [
      'Shared housing license may be required',
      'Parking space rentals typically allowed',
      'Zoning approval needed for commercial use'
    ],
    requiresPermit: false
  },
  'Austin, TX': {
    allowed: true,
    restrictions: [
      'Short-term rental license required for <30 days',
      'Parking space rentals generally unrestricted'
    ],
    requiresPermit: false
  }
};

class LegalComplianceChecker {
  /**
   * Parse address to extract city and state
   */
  private parseAddress(address: string): { city: string; state: string } {
    // Common patterns: "City, State" or "City, ST ZIP"
    const parts = address.split(',');
    
    let city = '';
    let state = '';
    
    if (parts.length >= 2) {
      city = parts[parts.length - 2].trim();
      const lastPart = parts[parts.length - 1].trim();
      // Extract state abbreviation (2 letters)
      const stateMatch = lastPart.match(/\b([A-Z]{2})\b/);
      state = stateMatch ? stateMatch[1] : '';
    }
    
    return { city, state };
  }

  /**
   * Check legal compliance using AI for unknown areas
   */
  async checkWithAI(address: string, city: string, state: string): Promise<{
    allowed: boolean;
    restrictions: string[];
    notes: string;
    sources: string[];
  }> {
    try {
      debug.info('Checking legal compliance with AI', { address, city, state });

      const response = await openaiRequestManager.makeRequest(
        'POST',
        '/chat/completions',
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a legal compliance expert specializing in short-term rental and parking space regulations in the United States. Provide accurate, helpful information about local laws.'
            },
            {
              role: 'user',
              content: `Is it legal to rent out a driveway, parking space, or garage in ${city}, ${state}?

Address: ${address}

Please provide:
1. Is it generally allowed? (yes/no/varies)
2. Any state-level restrictions
3. Any city/local restrictions  
4. Zoning considerations
5. Required permits or licenses
6. Tax implications
7. HOA considerations

Format your response as JSON:
{
  "allowed": boolean,
  "certainty": "high" | "medium" | "low",
  "restrictions": ["list of restrictions"],
  "notes": "detailed explanation",
  "sources": ["relevant laws or ordinances"]
}`
            }
          ],
          max_tokens: 800,
          temperature: 0.2 // Low temp for factual accuracy
        }
      );

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse JSON from AI response');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      debug.info('AI compliance check complete', {
        allowed: result.allowed,
        certainty: result.certainty,
        restrictionsCount: result.restrictions?.length
      });

      return {
        allowed: result.allowed !== false, // Default to true if unclear
        restrictions: result.restrictions || [],
        notes: result.notes || '',
        sources: result.sources || []
      };
    } catch (error) {
      debug.error('AI compliance check failed', error);
      // Default to allowed if we can't determine
      return {
        allowed: true,
        restrictions: ['Unable to verify local regulations'],
        notes: 'Please check local laws yourself',
        sources: []
      };
    }
  }

  /**
   * Main compliance check function
   */
  async checkCompliance(address: string, zipCode?: string): Promise<LegalComplianceResult> {
    try {
      debug.info('Starting legal compliance check', { address, zipCode });

      const { city, state } = this.parseAddress(address);
      
      debug.info('Parsed location', { city, state });

      // Initialize result
      const result: LegalComplianceResult = {
        isAllowed: true,
        certainty: 'unknown',
        state,
        city,
        zipCode: zipCode || '',
        restrictions: {
          stateLevel: {
            allowed: true,
            restrictions: [],
            notes: ''
          },
          cityLevel: {
            allowed: true,
            restrictions: [],
            notes: ''
          },
          zoningLevel: {
            allowed: true,
            restrictions: [],
            notes: ''
          }
        },
        warnings: [],
        requirements: [],
        recommendations: [],
        sources: [],
        checkedAt: new Date().toISOString()
      };

      // Check state-level regulations
      if (state && STATE_REGULATIONS[state]) {
        const stateReg = STATE_REGULATIONS[state];
        result.restrictions.stateLevel = {
          allowed: stateReg.allowed,
          restrictions: stateReg.restrictions,
          notes: stateReg.notes
        };
        result.certainty = 'high';

        if (stateReg.requiresPermit) {
          result.requirements.push('Business permit may be required');
        }
        
        if (stateReg.taxImplications) {
          result.requirements.push(stateReg.taxImplications);
        }
      }

      // Check city-level regulations
      const cityKey = `${city}, ${state}`;
      if (CITY_REGULATIONS[cityKey]) {
        const cityReg = CITY_REGULATIONS[cityKey];
        result.restrictions.cityLevel = {
          allowed: cityReg.allowed,
          restrictions: cityReg.restrictions,
          notes: cityReg.requiresPermit ? 'Permit required' : 'Generally allowed'
        };
        result.certainty = 'high';

        if (cityReg.requiresPermit && cityReg.permitUrl) {
          result.requirements.push(`Register at: ${cityReg.permitUrl}`);
        }
      } else if (state && city) {
        // Use AI to check unknown cities
        debug.info('City not in database, checking with AI', { city, state });
        
        const aiResult = await this.checkWithAI(address, city, state);
        result.restrictions.cityLevel = {
          allowed: aiResult.allowed,
          restrictions: aiResult.restrictions,
          notes: aiResult.notes
        };
        result.certainty = 'medium';
        result.sources = aiResult.sources;
      }

      // Determine overall status
      result.isAllowed = 
        result.restrictions.stateLevel.allowed && 
        result.restrictions.cityLevel.allowed;

      // Generate warnings
      if (!result.isAllowed) {
        result.warnings.push('⚠️ Driveway/parking space rentals may not be allowed in your area');
      }

      if (result.restrictions.stateLevel.restrictions.length > 0) {
        result.warnings.push('State-level restrictions apply');
      }

      if (result.restrictions.cityLevel.restrictions.length > 0) {
        result.warnings.push('Local city restrictions apply');
      }

      // Generate recommendations
      result.recommendations.push('Always check with your HOA if applicable');
      result.recommendations.push('Review your property deed for restrictions');
      result.recommendations.push('Consult local zoning department for commercial use');
      result.recommendations.push('Keep detailed records for tax purposes');

      debug.info('Compliance check complete', {
        isAllowed: result.isAllowed,
        certainty: result.certainty,
        warningsCount: result.warnings.length
      });

      return result;
    } catch (error) {
      debug.error('Compliance check failed', error);
      
      // Return permissive default on error
      return {
        isAllowed: true,
        certainty: 'unknown',
        state: '',
        city: '',
        zipCode: zipCode || '',
        restrictions: {
          stateLevel: { allowed: true, restrictions: [], notes: '' },
          cityLevel: { allowed: true, restrictions: [], notes: '' },
          zoningLevel: { allowed: true, restrictions: [], notes: '' }
        },
        warnings: ['Unable to verify local regulations - please check local laws'],
        requirements: [],
        recommendations: ['Consult a local attorney to verify compliance'],
        sources: [],
        checkedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get quick summary message
   */
  getComplianceSummary(result: LegalComplianceResult): string {
    if (!result.isAllowed) {
      return `⚠️ Driveway rentals may not be allowed in ${result.city}, ${result.state}. Please verify local laws before listing.`;
    }

    if (result.warnings.length > 0) {
      return `✓ Generally allowed in ${result.city}, ${result.state}, but some restrictions apply.`;
    }

    return `✅ Driveway rentals are allowed in ${result.city}, ${result.state}.`;
  }
}

export const legalComplianceChecker = new LegalComplianceChecker();
export type { LegalComplianceResult };

