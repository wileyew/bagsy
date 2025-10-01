import { createComponentDebugger } from "./debug-utils";

const debug = createComponentDebugger('LegalComplianceService');

export interface LegalComplianceResult {
  status: 'allowed' | 'restricted' | 'prohibited' | 'pending';
  state: string;
  county?: string;
  city?: string;
  details: {
    shortTermRentalAllowed: boolean;
    requiresPermit: boolean;
    permitUrl?: string;
    restrictions?: string[];
    maxDays?: number;
    zoning?: string;
    notes?: string;
  };
  sources?: string[];
  lastUpdated: string;
}

// State and local regulations database (mock data - in production, use real API)
const REGULATIONS_DATABASE: Record<string, any> = {
  'California': {
    default: {
      shortTermRentalAllowed: true,
      requiresPermit: false,
      restrictions: ['Must comply with local zoning laws', 'Insurance required'],
      notes: 'State allows driveway rentals, but check local ordinances'
    },
    counties: {
      'San Francisco': {
        shortTermRentalAllowed: true,
        requiresPermit: true,
        permitUrl: 'https://sfplanning.org/short-term-rentals',
        restrictions: ['Business registration required', 'Cannot exceed 90 days/year'],
        maxDays: 90,
        notes: 'San Francisco requires registration for all short-term rentals'
      },
      'Los Angeles': {
        shortTermRentalAllowed: true,
        requiresPermit: true,
        permitUrl: 'https://planning.lacity.org/short-term-rentals',
        restrictions: ['Primary residence only', 'TOT tax collection required'],
        notes: 'Los Angeles has strict short-term rental regulations'
      }
    }
  },
  'New York': {
    default: {
      shortTermRentalAllowed: true,
      requiresPermit: false,
      restrictions: ['Must comply with Multiple Dwelling Law'],
      notes: 'New York allows parking space rentals with proper zoning'
    },
    counties: {
      'New York': {
        shortTermRentalAllowed: true,
        requiresPermit: true,
        restrictions: ['Commercial parking license may be required', 'Zoning approval needed'],
        notes: 'NYC requires commercial parking operation permits for regular rentals'
      }
    }
  },
  'Texas': {
    default: {
      shortTermRentalAllowed: true,
      requiresPermit: false,
      restrictions: [],
      notes: 'Texas is generally permissive for property rights including driveway rentals'
    }
  },
  'Florida': {
    default: {
      shortTermRentalAllowed: true,
      requiresPermit: false,
      restrictions: ['Local HOA rules may apply'],
      notes: 'Florida allows driveway rentals, check HOA restrictions'
    }
  },
  'Washington': {
    default: {
      shortTermRentalAllowed: true,
      requiresPermit: false,
      restrictions: ['Business license may be required'],
      notes: 'Washington state allows parking rentals with proper business registration'
    }
  }
};

class LegalComplianceService {
  /**
   * Check legal compliance for a property address
   */
  async checkCompliance(address: string, zipCode?: string): Promise<LegalComplianceResult> {
    debug.info('Checking legal compliance', { address, zipCode });

    try {
      // Extract location information from address
      const location = this.parseAddress(address);
      
      // Get regulations for the location
      const regulations = this.getRegulations(location.state, location.county);
      
      // Determine compliance status
      const status = this.determineStatus(regulations);
      
      const result: LegalComplianceResult = {
        status,
        state: location.state,
        county: location.county,
        city: location.city,
        details: regulations,
        sources: this.getSources(location.state),
        lastUpdated: new Date().toISOString()
      };

      debug.info('Legal compliance check completed', result);
      return result;
    } catch (error) {
      debug.error('Legal compliance check failed', error);
      
      // Return pending status if check fails
      return {
        status: 'pending',
        state: 'Unknown',
        details: {
          shortTermRentalAllowed: false,
          requiresPermit: false,
          notes: 'Unable to verify legal compliance. Please consult local regulations.'
        },
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Parse address to extract state, county, city
   */
  private parseAddress(address: string): { state: string; county?: string; city?: string } {
    debug.debug('Parsing address', { address });

    const addressLower = address.toLowerCase();
    
    // Extract state (simplified - in production use proper geocoding API)
    const statePatterns: Record<string, string[]> = {
      'California': ['california', 'ca', 'san francisco', 'los angeles', 'san diego'],
      'New York': ['new york', 'ny', 'nyc', 'manhattan', 'brooklyn'],
      'Texas': ['texas', 'tx', 'houston', 'dallas', 'austin'],
      'Florida': ['florida', 'fl', 'miami', 'tampa', 'orlando'],
      'Washington': ['washington', 'wa', 'seattle', 'spokane'],
      'Illinois': ['illinois', 'il', 'chicago'],
      'Pennsylvania': ['pennsylvania', 'pa', 'philadelphia'],
      'Arizona': ['arizona', 'az', 'phoenix'],
      'Massachusetts': ['massachusetts', 'ma', 'boston'],
      'Georgia': ['georgia', 'ga', 'atlanta']
    };

    let detectedState = 'Unknown';
    let detectedCounty: string | undefined;
    let detectedCity: string | undefined;

    for (const [state, patterns] of Object.entries(statePatterns)) {
      if (patterns.some(pattern => addressLower.includes(pattern))) {
        detectedState = state;
        
        // Check for specific counties/cities
        if (addressLower.includes('san francisco')) {
          detectedCounty = 'San Francisco';
          detectedCity = 'San Francisco';
        } else if (addressLower.includes('los angeles')) {
          detectedCounty = 'Los Angeles';
          detectedCity = 'Los Angeles';
        } else if (addressLower.includes('new york') || addressLower.includes('nyc')) {
          detectedCounty = 'New York';
          detectedCity = 'New York City';
        }
        
        break;
      }
    }

    return {
      state: detectedState,
      county: detectedCounty,
      city: detectedCity
    };
  }

  /**
   * Get regulations for a specific location
   */
  private getRegulations(state: string, county?: string): LegalComplianceResult['details'] {
    debug.debug('Getting regulations', { state, county });

    const stateRegs = REGULATIONS_DATABASE[state];
    
    if (!stateRegs) {
      return {
        shortTermRentalAllowed: true,
        requiresPermit: false,
        notes: `No specific regulations found for ${state}. Check with local authorities.`
      };
    }

    // Check for county-specific regulations
    if (county && stateRegs.counties && stateRegs.counties[county]) {
      return stateRegs.counties[county];
    }

    // Return state default
    return stateRegs.default;
  }

  /**
   * Determine compliance status based on regulations
   */
  private determineStatus(regulations: LegalComplianceResult['details']): LegalComplianceResult['status'] {
    if (!regulations.shortTermRentalAllowed) {
      return 'prohibited';
    }

    if (regulations.requiresPermit || (regulations.restrictions && regulations.restrictions.length > 2)) {
      return 'restricted';
    }

    return 'allowed';
  }

  /**
   * Get source URLs for regulations
   */
  private getSources(state: string): string[] {
    const sources: Record<string, string[]> = {
      'California': [
        'https://leginfo.legislature.ca.gov',
        'https://www.hcd.ca.gov'
      ],
      'New York': [
        'https://www.nyc.gov/site/buildings',
        'https://www.dos.ny.gov'
      ],
      'Texas': [
        'https://www.tdlr.texas.gov'
      ],
      'Florida': [
        'https://www.myfloridalicense.com'
      ],
      'Washington': [
        'https://www.commerce.wa.gov'
      ]
    };

    return sources[state] || ['https://www.usa.gov/state-local-governments'];
  }

  /**
   * Format compliance status for display
   */
  formatComplianceStatus(status: LegalComplianceResult['status']): { color: string; icon: string; label: string } {
    switch (status) {
      case 'allowed':
        return {
          color: 'text-green-600 bg-green-50 border-green-200',
          icon: '✓',
          label: 'Allowed'
        };
      case 'restricted':
        return {
          color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
          icon: '⚠',
          label: 'Restricted'
        };
      case 'prohibited':
        return {
          color: 'text-red-600 bg-red-50 border-red-200',
          icon: '✗',
          label: 'Prohibited'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          icon: '?',
          label: 'Pending'
        };
    }
  }
}

export const legalComplianceService = new LegalComplianceService();

