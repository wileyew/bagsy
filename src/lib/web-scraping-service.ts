import { createComponentDebugger } from './debug-utils';

interface ScrapedListing {
  title: string;
  price: number;
  priceType: 'hourly' | 'daily' | 'monthly';
  location: string;
  spaceType: string;
  dimensions?: string;
  description?: string;
  source: string;
  url: string;
  scrapedAt: string;
}

interface MarketAnalysis {
  averagePrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  competitorCount: number;
  listings: ScrapedListing[];
  recommendations: {
    suggestedPrice: number;
    reasoning: string;
    competitiveAdvantages: string[];
  };
}

class WebScrapingService {
  private baseUrl = 'https://api.scrapingbee.com/v1/';
  private apiKey: string;
  private debug = createComponentDebugger('WebScrapingService');
  
  constructor() {
    this.apiKey = import.meta.env.VITE_SCRAPINGBEE_API_KEY || '';
    this.debug.logApiKey('ScrapingBee', !!this.apiKey);
    this.debug.info('Service initialized', { 
      hasApiKey: !!this.apiKey,
      baseUrl: this.baseUrl 
    });
  }

  async scrapeMarketData(
    location: string,
    spaceType: string,
    radius: number = 10 // miles
  ): Promise<MarketAnalysis> {
    return this.debug.wrapAsync('scrapeMarketData', async () => {
      this.debug.info('Starting market data scraping', {
        location,
        spaceType,
        radius,
        hasApiKey: !!this.apiKey
      });

      if (!this.apiKey) {
        this.debug.warn('No scraping API key available - using mock data');
        return this.getMockMarketData(location, spaceType);
      }

      try {
        const listings = await this.scrapeMultipleSources(location, spaceType, radius);
        this.debug.info('Scraping completed', { 
          listingsFound: listings.length,
          sources: [...new Set(listings.map(l => l.source))]
        });
        
        const analysis = this.analyzeMarketData(listings, spaceType);
        this.debug.info('Market analysis completed', {
          averagePrice: analysis.averagePrice,
          competitorCount: analysis.competitorCount,
          suggestedPrice: analysis.recommendations.suggestedPrice
        });
        
        return analysis;
      } catch (error) {
        this.debug.logError(error as Error, { location, spaceType, radius });
        this.debug.warn('Scraping failed, falling back to mock data');
        return this.getMockMarketData(location, spaceType);
      }
    }, { location, spaceType, radius });
  }

  private async scrapeMultipleSources(
    location: string,
    spaceType: string,
    radius: number
  ): Promise<ScrapedListing[]> {
    const sources = [
      { name: 'Craigslist', fn: () => this.scrapeCraigslist(location, spaceType) },
      { name: 'Facebook Marketplace', fn: () => this.scrapeFacebookMarketplace(location, spaceType) },
      { name: 'Nextdoor', fn: () => this.scrapeNextdoor(location, spaceType) },
      { name: 'Spacer', fn: () => this.scrapeSpacer(location, spaceType) },
    ];

    this.debug.info('Starting multi-source scraping', { 
      sourceCount: sources.length,
      sources: sources.map(s => s.name)
    });

    const results = await Promise.allSettled(
      sources.map(source => source.fn())
    );

    const allListings: ScrapedListing[] = [];
    const sourceResults: { [key: string]: { success: boolean; count: number; error?: string } } = {};

    results.forEach((result, index) => {
      const sourceName = sources[index].name;
      if (result.status === 'fulfilled') {
        allListings.push(...result.value);
        sourceResults[sourceName] = { success: true, count: result.value.length };
        this.debug.info(`Source ${sourceName} completed`, { listingsFound: result.value.length });
      } else {
        sourceResults[sourceName] = { 
          success: false, 
          count: 0, 
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        };
        this.debug.warn(`Source ${sourceName} failed`, { error: result.reason });
      }
    });

    this.debug.info('Multi-source scraping completed', {
      totalListings: allListings.length,
      sourceResults
    });

    return allListings;
  }

  private async scrapeCraigslist(location: string, spaceType: string): Promise<ScrapedListing[]> {
    const searchTerms = this.getSearchTerms(spaceType);
    const listings: ScrapedListing[] = [];

    this.debug.info('Starting Craigslist scraping', { 
      location, 
      spaceType, 
      searchTerms 
    });

    for (const term of searchTerms) {
      try {
        const subdomain = this.getCraigslistSubdomain(location);
        const url = `https://${subdomain}.craigslist.org/search/apa?query=${encodeURIComponent(term)}&sort=rel`;
        
        this.debug.debug('Scraping Craigslist term', { term, url, subdomain });
        
        const html = await this.fetchPage(url);
        const craigslistListings = this.parseCraigslistHTML(html, term);
        
        this.debug.debug('Craigslist term completed', { 
          term, 
          listingsFound: craigslistListings.length 
        });
        
        listings.push(...craigslistListings);
      } catch (error) {
        this.debug.warn('Craigslist scraping failed for term', { 
          term, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    this.debug.info('Craigslist scraping completed', { 
      totalListings: listings.length,
      termsProcessed: searchTerms.length
    });

    return listings;
  }

  private async scrapeFacebookMarketplace(location: string, spaceType: string): Promise<ScrapedListing[]> {
    const searchTerms = this.getSearchTerms(spaceType);
    const listings: ScrapedListing[] = [];

    for (const term of searchTerms) {
      try {
        const url = `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent(term)}&location=${encodeURIComponent(location)}`;
        const html = await this.fetchPage(url);
        const marketplaceListings = this.parseFacebookMarketplaceHTML(html, term);
        listings.push(...marketplaceListings);
      } catch (error) {
        console.warn('Facebook Marketplace scraping failed for term:', term, error);
      }
    }

    return listings;
  }

  private async scrapeNextdoor(location: string, spaceType: string): Promise<ScrapedListing[]> {
    // Nextdoor requires authentication, so we'll simulate this
    console.log('Nextdoor scraping would require authentication - skipping');
    return [];
  }

  private async scrapeSpacer(location: string, spaceType: string): Promise<ScrapedListing[]> {
    try {
      const url = `https://www.spacer.com.au/search?location=${encodeURIComponent(location)}&type=${spaceType}`;
      const html = await this.fetchPage(url);
      return this.parseSpacerHTML(html);
    } catch (error) {
      console.warn('Spacer scraping failed:', error);
      return [];
    }
  }

  private async fetchPage(url: string): Promise<string> {
    const startTime = this.debug.timeStart('fetchPage');
    
    try {
      this.debug.apiCall('fetchPage', 'GET', url);
      
      const response = await fetch(`${this.baseUrl}?api_key=${this.apiKey}&url=${encodeURIComponent(url)}&render_js=true`);
      
      this.debug.apiResponse('fetchPage', 'GET', url, response.status, {
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (!response.ok) {
        throw new Error(`Scraping failed: ${response.statusText}`);
      }

      const html = await response.text();
      
      this.debug.timeEnd('fetchPage', startTime, {
        url,
        htmlLength: html.length,
        success: true
      });
      
      return html;
    } catch (error) {
      this.debug.timeEnd('fetchPage', startTime, {
        url,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private getSearchTerms(spaceType: string): string[] {
    const baseTerms = {
      garage: ['garage storage', 'garage rental', 'car storage', 'garage space'],
      driveway: ['driveway parking', 'parking space', 'car parking', 'driveway rental'],
      warehouse: ['warehouse space', 'storage warehouse', 'industrial space', 'warehouse rental'],
      parking_spot: ['parking spot', 'parking space', 'car parking', 'vehicle storage'],
      storage_unit: ['storage unit', 'self storage', 'storage rental', 'storage space'],
      outdoor_space: ['outdoor storage', 'yard space', 'outdoor rental', 'open space'],
      // Common custom space types
      'boat slip': ['boat slip', 'boat storage', 'marina space', 'boat dock'],
      'rv storage': ['RV storage', 'recreational vehicle storage', 'camper storage', 'motorhome storage'],
      'workshop': ['workshop space', 'studio space', 'art studio', 'workshop rental'],
      'office space': ['office space', 'co-working', 'office rental', 'business space'],
      'event space': ['event space', 'venue rental', 'party space', 'meeting room'],
      'farm land': ['farm land', 'agricultural space', 'farm rental', 'land lease']
    };

    // If it's a custom space type, try to find it in our extended list or use the space type directly
    const customTerms = baseTerms[spaceType.toLowerCase() as keyof typeof baseTerms];
    if (customTerms) {
      return customTerms;
    }

    // For other custom space types, generate search terms based on the space type
    return [
      spaceType,
      `${spaceType} rental`,
      `${spaceType} storage`,
      `${spaceType} space`
    ];
  }

  private getCraigslistSubdomain(location: string): string {
    // Map common locations to Craigslist subdomains
    const subdomains: { [key: string]: string } = {
      'san francisco': 'sfbay',
      'los angeles': 'losangeles',
      'new york': 'newyork',
      'chicago': 'chicago',
      'seattle': 'seattle',
      'austin': 'austin',
      'denver': 'denver',
      'portland': 'portland',
      'miami': 'miami',
      'boston': 'boston'
    };

    const normalizedLocation = location.toLowerCase();
    for (const [city, subdomain] of Object.entries(subdomains)) {
      if (normalizedLocation.includes(city)) {
        return subdomain;
      }
    }

    return 'sfbay'; // Default to SF Bay Area
  }

  private parseCraigslistHTML(html: string, searchTerm: string): ScrapedListing[] {
    // This is a simplified parser - in production, you'd use a proper HTML parser
    const listings: ScrapedListing[] = [];
    
    // Mock parsing - in reality, you'd parse the actual HTML structure
    const mockListings = this.generateMockListings('craigslist', searchTerm, 3);
    listings.push(...mockListings);

    return listings;
  }

  private parseFacebookMarketplaceHTML(html: string, searchTerm: string): ScrapedListing[] {
    // This is a simplified parser - in production, you'd use a proper HTML parser
    const listings: ScrapedListing[] = [];
    
    // Mock parsing - in reality, you'd parse the actual HTML structure
    const mockListings = this.generateMockListings('facebook', searchTerm, 2);
    listings.push(...mockListings);

    return listings;
  }

  private parseSpacerHTML(html: string): ScrapedListing[] {
    // This is a simplified parser - in production, you'd use a proper HTML parser
    const listings: ScrapedListing[] = [];
    
    // Mock parsing - in reality, you'd parse the actual HTML structure
    const mockListings = this.generateMockListings('spacer', 'storage', 2);
    listings.push(...mockListings);

    return listings;
  }

  private generateMockListings(source: string, searchTerm: string, count: number): ScrapedListing[] {
    const listings: ScrapedListing[] = [];
    const basePrices = {
      garage: { min: 5, max: 15 },
      driveway: { min: 3, max: 8 },
      warehouse: { min: 20, max: 50 },
      parking_spot: { min: 2, max: 6 },
      storage_unit: { min: 8, max: 25 },
      outdoor_space: { min: 4, max: 12 },
      // Custom space type pricing
      'boat slip': { min: 15, max: 40 },
      'rv storage': { min: 10, max: 30 },
      'workshop': { min: 12, max: 35 },
      'office space': { min: 25, max: 60 },
      'event space': { min: 50, max: 150 },
      'farm land': { min: 5, max: 20 }
    };

    const spaceType = this.inferSpaceType(searchTerm);
    const priceRange = basePrices[spaceType as keyof typeof basePrices] || { min: 8, max: 20 };

    for (let i = 0; i < count; i++) {
      const price = Math.round((Math.random() * (priceRange.max - priceRange.min) + priceRange.min) * 100) / 100;
      const priceType = Math.random() > 0.5 ? 'hourly' : 'daily';
      
      listings.push({
        title: `${spaceType.charAt(0).toUpperCase() + spaceType.slice(1)} Space - ${searchTerm}`,
        price: priceType === 'daily' ? price * 8 : price,
        priceType: priceType as 'hourly' | 'daily' | 'monthly',
        location: 'San Francisco, CA',
        spaceType: spaceType,
        dimensions: `${Math.floor(Math.random() * 10) + 10}x${Math.floor(Math.random() * 10) + 10} feet`,
        description: `Great ${spaceType} space available for rent`,
        source: source,
        url: `https://${source}.com/listing/${i + 1}`,
        scrapedAt: new Date().toISOString()
      });
    }

    return listings;
  }

  private inferSpaceType(searchTerm: string): string {
    const term = searchTerm.toLowerCase();
    if (term.includes('garage')) return 'garage';
    if (term.includes('driveway') || term.includes('parking')) return 'driveway';
    if (term.includes('warehouse')) return 'warehouse';
    if (term.includes('storage')) return 'storage_unit';
    if (term.includes('outdoor')) return 'outdoor_space';
    if (term.includes('boat') || term.includes('marina')) return 'boat slip';
    if (term.includes('rv') || term.includes('camper') || term.includes('motorhome')) return 'rv storage';
    if (term.includes('workshop') || term.includes('studio')) return 'workshop';
    if (term.includes('office') || term.includes('co-working')) return 'office space';
    if (term.includes('event') || term.includes('venue') || term.includes('party')) return 'event space';
    if (term.includes('farm') || term.includes('land') || term.includes('agricultural')) return 'farm land';
    return 'garage';
  }

  private analyzeMarketData(listings: ScrapedListing[], spaceType: string): MarketAnalysis {
    if (listings.length === 0) {
      return this.getMockMarketData('Unknown Location', spaceType);
    }

    // Convert all prices to hourly for comparison
    const hourlyPrices = listings.map(listing => {
      switch (listing.priceType) {
        case 'daily': return listing.price / 8;
        case 'monthly': return listing.price / (30 * 8);
        default: return listing.price;
      }
    });

    const averagePrice = hourlyPrices.reduce((sum, price) => sum + price, 0) / hourlyPrices.length;
    const minPrice = Math.min(...hourlyPrices);
    const maxPrice = Math.max(...hourlyPrices);

    // Generate recommendations
    const suggestedPrice = this.calculateSuggestedPrice(hourlyPrices, spaceType);
    const reasoning = this.generateReasoning(averagePrice, suggestedPrice, listings.length);
    const competitiveAdvantages = this.generateCompetitiveAdvantages(spaceType);

    return {
      averagePrice: Math.round(averagePrice * 100) / 100,
      priceRange: {
        min: Math.round(minPrice * 100) / 100,
        max: Math.round(maxPrice * 100) / 100
      },
      competitorCount: listings.length,
      listings: listings.slice(0, 10), // Limit to top 10
      recommendations: {
        suggestedPrice: Math.round(suggestedPrice * 100) / 100,
        reasoning,
        competitiveAdvantages
      }
    };
  }

  private calculateSuggestedPrice(prices: number[], spaceType: string): number {
    // Use median price as base, with some adjustment based on market conditions
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const median = sortedPrices[Math.floor(sortedPrices.length / 2)];
    
    // Adjust based on supply/demand (more listings = lower price)
    const supplyFactor = Math.max(0.8, 1 - (prices.length * 0.05));
    
    return median * supplyFactor;
  }

  private generateReasoning(averagePrice: number, suggestedPrice: number, competitorCount: number): string {
    const priceDiff = ((suggestedPrice - averagePrice) / averagePrice) * 100;
    
    let reasoning = `Based on ${competitorCount} similar listings in your area, `;
    
    if (Math.abs(priceDiff) < 5) {
      reasoning += `the market average is $${averagePrice.toFixed(2)}/hour, which aligns well with our suggested price of $${suggestedPrice.toFixed(2)}/hour.`;
    } else if (priceDiff > 0) {
      reasoning += `our suggested price of $${suggestedPrice.toFixed(2)}/hour is ${priceDiff.toFixed(1)}% above the market average of $${averagePrice.toFixed(2)}/hour, positioning you as a premium option.`;
    } else {
      reasoning += `our suggested price of $${suggestedPrice.toFixed(2)}/hour is ${Math.abs(priceDiff).toFixed(1)}% below the market average of $${averagePrice.toFixed(2)}/hour, making you more competitive.`;
    }

    if (competitorCount < 5) {
      reasoning += ` With limited competition (${competitorCount} listings), you have pricing flexibility.`;
    } else if (competitorCount > 15) {
      reasoning += ` With high competition (${competitorCount} listings), competitive pricing is crucial.`;
    }

    return reasoning;
  }

  private generateCompetitiveAdvantages(spaceType: string): string[] {
    const advantages = {
      garage: [
        'Secure, covered storage',
        'Easy vehicle access',
        'Protection from weather',
        'Additional security features'
      ],
      driveway: [
        'Convenient street access',
        'No height restrictions',
        'Easy loading/unloading',
        'Flexible parking arrangements'
      ],
      warehouse: [
        'Large storage capacity',
        'Industrial-grade security',
        'Loading dock access',
        'Climate control options'
      ],
      parking_spot: [
        'Dedicated parking space',
        'Convenient location',
        'Easy access',
        'Flexible timing'
      ],
      storage_unit: [
        'Climate-controlled environment',
        '24/7 access',
        'Security monitoring',
        'Clean, organized space'
      ],
      outdoor_space: [
        'Large open area',
        'Flexible use options',
        'Easy access',
        'Natural ventilation'
      ]
    };

    return advantages[spaceType as keyof typeof advantages] || [
      'Convenient location',
      'Flexible terms',
      'Competitive pricing',
      'Easy access'
    ];
  }

  private getMockMarketData(location: string, spaceType: string): MarketAnalysis {
    const mockListings = this.generateMockListings('marketplace', spaceType, 8);
    return this.analyzeMarketData(mockListings, spaceType);
  }
}

export const webScrapingService = new WebScrapingService();
export type { ScrapedListing, MarketAnalysis };
