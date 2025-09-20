import { supabase } from "@/integrations/supabase/client";
import { createComponentDebugger } from "./debug-utils";

const debug = createComponentDebugger('SmartMatchingService');

export interface RenterProfile {
  userId: string;
  preferences: {
    spaceTypes: string[];
    priceRange: { min: number; max: number };
    locations: string[];
    amenities: string[];
  };
  searchHistory: SearchQuery[];
  bookingHistory: BookingHistory[];
  behaviorPatterns: BehaviorPattern[];
}

export interface SearchQuery {
  query: string;
  filters: Record<string, any>;
  timestamp: string;
  resultsClicked: string[];
}

export interface BookingHistory {
  spaceId: string;
  bookingDate: string;
  duration: number;
  price: number;
  rating?: number;
  feedback?: string;
}

export interface BehaviorPattern {
  patternType: 'search_frequency' | 'booking_timing' | 'price_sensitivity' | 'location_preference';
  data: Record<string, any>;
  confidence: number;
}

export interface SpaceMatch {
  spaceId: string;
  matchScore: number; // 0-1
  reasons: string[];
  confidence: number;
  suggestedPrice?: number;
  alternativeTimes?: string[];
}

export interface SpaceRecommendation {
  spaceId: string;
  recommendationScore: number;
  reasons: string[];
  personalizedMessage: string;
  urgency: 'low' | 'medium' | 'high';
}

export interface RankedSpace {
  spaceId: string;
  rank: number;
  relevanceScore: number;
  rankingFactors: string[];
}

export interface SearchCriteria {
  query?: string;
  spaceTypes?: string[];
  priceRange?: { min: number; max: number };
  location?: string;
  amenities?: string[];
  availability?: { start: string; end: string };
}

class SmartMatchingService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  /**
   * Match renters with optimal spaces based on preferences
   */
  async findOptimalMatches(renterProfile: RenterProfile, availableSpaces: any[]): Promise<SpaceMatch[]> {
    debug.info('Finding optimal matches', { 
      userId: renterProfile.userId, 
      spaceCount: availableSpaces.length 
    });

    try {
      // Get user preferences from database
      const preferences = await this.getUserPreferences(renterProfile.userId);
      
      // Calculate match scores for each space
      const matches: SpaceMatch[] = [];
      
      for (const space of availableSpaces) {
        const matchScore = this.calculateMatchScore(space, preferences, renterProfile);
        
        if (matchScore > 0.3) { // Only include decent matches
          matches.push({
            spaceId: space.id,
            matchScore,
            reasons: this.generateMatchReasons(space, preferences),
            confidence: this.calculateConfidence(space, preferences),
            suggestedPrice: this.suggestOptimalPrice(space, preferences)
          });
        }
      }

      // Sort by match score
      matches.sort((a, b) => b.matchScore - a.matchScore);

      // Use AI to enhance matches if available
      if (this.apiKey && matches.length > 0) {
        return await this.aiEnhanceMatches(matches, renterProfile, availableSpaces);
      }

      return matches;
    } catch (error) {
      debug.error('Failed to find optimal matches', error);
      throw error;
    }
  }

  /**
   * Analyze renter behavior to suggest spaces
   */
  async suggestSpacesBasedOnHistory(userId: string, searchCriteria: SearchCriteria): Promise<SpaceRecommendation[]> {
    debug.info('Suggesting spaces based on history', { userId, searchCriteria });

    try {
      // Get user's booking and search history
      const userProfile = await this.buildUserProfile(userId);
      
      // Get available spaces
      const { data: spaces, error: spacesError } = await supabase
        .from('spaces')
        .select('*')
        .eq('is_active', true);

      if (spacesError) {
        throw new Error(`Failed to fetch spaces: ${spacesError.message}`);
      }

      // Generate recommendations
      const recommendations: SpaceRecommendation[] = [];
      
      for (const space of spaces || []) {
        const recommendationScore = this.calculateRecommendationScore(space, userProfile, searchCriteria);
        
        if (recommendationScore > 0.4) {
          recommendations.push({
            spaceId: space.id,
            recommendationScore,
            reasons: this.generateRecommendationReasons(space, userProfile),
            personalizedMessage: this.generatePersonalizedMessage(space, userProfile),
            urgency: this.calculateUrgency(space, userProfile)
          });
        }
      }

      // Sort by recommendation score
      recommendations.sort((a, b) => b.recommendationScore - a.recommendationScore);

      // Use AI to enhance recommendations if available
      if (this.apiKey && recommendations.length > 0) {
        return await this.aiEnhanceRecommendations(recommendations, userProfile, spaces || []);
      }

      return recommendations.slice(0, 10); // Return top 10
    } catch (error) {
      debug.error('Failed to suggest spaces based on history', error);
      throw error;
    }
  }

  /**
   * Optimize search results ranking
   */
  async rankSearchResults(searchQuery: string, spaces: any[], userProfile: RenterProfile): Promise<RankedSpace[]> {
    debug.info('Ranking search results', { 
      query: searchQuery, 
      spaceCount: spaces.length,
      userId: userProfile.userId 
    });

    try {
      const rankedSpaces: RankedSpace[] = [];

      for (const space of spaces) {
        const relevanceScore = this.calculateRelevanceScore(space, searchQuery, userProfile);
        
        rankedSpaces.push({
          spaceId: space.id,
          rank: 0, // Will be set after sorting
          relevanceScore,
          rankingFactors: this.generateRankingFactors(space, searchQuery, userProfile)
        });
      }

      // Sort by relevance score
      rankedSpaces.sort((a, b) => b.relevanceScore - a.relevanceScore);
      
      // Assign ranks
      rankedSpaces.forEach((space, index) => {
        space.rank = index + 1;
      });

      // Use AI to enhance ranking if available
      if (this.apiKey && rankedSpaces.length > 0) {
        return await this.aiEnhanceRanking(rankedSpaces, searchQuery, userProfile, spaces);
      }

      return rankedSpaces;
    } catch (error) {
      debug.error('Failed to rank search results', error);
      throw error;
    }
  }

  /**
   * Update user preferences based on behavior
   */
  async updateUserPreferences(userId: string, behaviorData: any): Promise<void> {
    debug.info('Updating user preferences', { userId });

    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          search_history: behaviorData.searchHistory || {},
          booking_patterns: behaviorData.bookingPatterns || {},
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to update preferences: ${error.message}`);
      }

      debug.info('User preferences updated successfully');
    } catch (error) {
      debug.error('Failed to update user preferences', error);
      throw error;
    }
  }

  /**
   * Track user search behavior
   */
  async trackSearchBehavior(userId: string, searchQuery: string, filters: Record<string, any>, resultsClicked: string[]): Promise<void> {
    debug.info('Tracking search behavior', { userId, query: searchQuery });

    try {
      const searchData = {
        query: searchQuery,
        filters,
        timestamp: new Date().toISOString(),
        resultsClicked
      };

      // Get existing preferences
      const { data: existingPrefs, error: fetchError } = await supabase
        .from('user_preferences')
        .select('search_history')
        .eq('user_id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch existing preferences: ${fetchError.message}`);
      }

      const searchHistory = existingPrefs?.search_history || [];
      searchHistory.push(searchData);

      // Keep only last 50 searches
      const recentHistory = searchHistory.slice(-50);

      await this.updateUserPreferences(userId, { searchHistory: recentHistory });
    } catch (error) {
      debug.error('Failed to track search behavior', error);
      // Don't throw error for tracking failures
    }
  }

  // Private helper methods

  private async getUserPreferences(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user preferences: ${error.message}`);
    }

    return data || {
      space_type_preferences: [],
      price_range_min: 0,
      price_range_max: 100,
      location_preferences: [],
      amenities_preferences: []
    };
  }

  private async buildUserProfile(userId: string): Promise<RenterProfile> {
    const preferences = await this.getUserPreferences(userId);
    
    // Get booking history
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .eq('renter_id', userId)
      .eq('status', 'confirmed');

    if (bookingsError) {
      debug.warn('Failed to fetch booking history', bookingsError);
    }

    const bookingHistory: BookingHistory[] = (bookings || []).map(booking => ({
      spaceId: booking.space_id,
      bookingDate: booking.start_time,
      duration: (new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / (1000 * 60 * 60),
      price: booking.total_price
    }));

    // Analyze behavior patterns
    const behaviorPatterns = this.analyzeBehaviorPatterns(preferences, bookingHistory);

    return {
      userId,
      preferences: {
        spaceTypes: preferences.space_type_preferences || [],
        priceRange: {
          min: preferences.price_range_min || 0,
          max: preferences.price_range_max || 100
        },
        locations: preferences.location_preferences || [],
        amenities: preferences.amenities_preferences || []
      },
      searchHistory: preferences.search_history || [],
      bookingHistory,
      behaviorPatterns
    };
  }

  private calculateMatchScore(space: any, preferences: any, profile: RenterProfile): number {
    let score = 0;
    let factors = 0;

    // Space type match
    if (preferences.space_type_preferences?.includes(space.space_type)) {
      score += 0.3;
    }
    factors++;

    // Price range match
    if (space.price_per_hour >= preferences.price_range_min && 
        space.price_per_hour <= preferences.price_range_max) {
      score += 0.3;
    }
    factors++;

    // Location match
    if (preferences.location_preferences?.some((loc: string) => 
        space.address.toLowerCase().includes(loc.toLowerCase()))) {
      score += 0.2;
    }
    factors++;

    // Historical preference match
    const similarBookings = profile.bookingHistory.filter(booking => 
      booking.price >= space.price_per_hour * 0.8 && 
      booking.price <= space.price_per_hour * 1.2
    );
    
    if (similarBookings.length > 0) {
      score += 0.2;
    }
    factors++;

    return factors > 0 ? score / factors : 0;
  }

  private calculateRecommendationScore(space: any, profile: RenterProfile, criteria: SearchCriteria): number {
    let score = 0;
    let factors = 0;

    // Space type preference
    if (profile.preferences.spaceTypes.includes(space.space_type)) {
      score += 0.25;
    }
    factors++;

    // Price preference
    if (space.price_per_hour >= profile.preferences.priceRange.min && 
        space.price_per_hour <= profile.preferences.priceRange.max) {
      score += 0.25;
    }
    factors++;

    // Location preference
    if (profile.preferences.locations.some(loc => 
        space.address.toLowerCase().includes(loc.toLowerCase()))) {
      score += 0.2;
    }
    factors++;

    // Booking history similarity
    const avgBookingPrice = profile.bookingHistory.reduce((sum, booking) => sum + booking.price, 0) / 
                          Math.max(profile.bookingHistory.length, 1);
    
    if (Math.abs(space.price_per_hour - avgBookingPrice) / avgBookingPrice < 0.2) {
      score += 0.2;
    }
    factors++;

    // Search criteria match
    if (criteria.spaceTypes?.includes(space.space_type)) {
      score += 0.1;
    }
    factors++;

    return factors > 0 ? score / factors : 0;
  }

  private calculateRelevanceScore(space: any, query: string, profile: RenterProfile): number {
    let score = 0;
    let factors = 0;

    // Text relevance
    const queryWords = query.toLowerCase().split(' ');
    const spaceText = `${space.title} ${space.description} ${space.address}`.toLowerCase();
    
    const matchingWords = queryWords.filter(word => spaceText.includes(word));
    score += (matchingWords.length / queryWords.length) * 0.4;
    factors++;

    // User preference relevance
    const preferenceScore = this.calculateMatchScore(space, profile.preferences, profile);
    score += preferenceScore * 0.3;
    factors++;

    // Price relevance
    if (space.price_per_hour >= profile.preferences.priceRange.min && 
        space.price_per_hour <= profile.preferences.priceRange.max) {
      score += 0.2;
    }
    factors++;

    // Location relevance
    if (profile.preferences.locations.some(loc => 
        space.address.toLowerCase().includes(loc.toLowerCase()))) {
      score += 0.1;
    }
    factors++;

    return factors > 0 ? score / factors : 0;
  }

  private generateMatchReasons(space: any, preferences: any): string[] {
    const reasons: string[] = [];

    if (preferences.space_type_preferences?.includes(space.space_type)) {
      reasons.push(`Matches your preferred space type: ${space.space_type}`);
    }

    if (space.price_per_hour >= preferences.price_range_min && 
        space.price_per_hour <= preferences.price_range_max) {
      reasons.push(`Within your price range: $${space.price_per_hour}/hour`);
    }

    if (preferences.location_preferences?.some((loc: string) => 
        space.address.toLowerCase().includes(loc.toLowerCase()))) {
      reasons.push('Located in your preferred area');
    }

    return reasons;
  }

  private generateRecommendationReasons(space: any, profile: RenterProfile): string[] {
    const reasons: string[] = [];

    if (profile.preferences.spaceTypes.includes(space.space_type)) {
      reasons.push(`Similar to spaces you've booked before`);
    }

    const avgPrice = profile.bookingHistory.reduce((sum, booking) => sum + booking.price, 0) / 
                    Math.max(profile.bookingHistory.length, 1);
    
    if (Math.abs(space.price_per_hour - avgPrice) / avgPrice < 0.2) {
      reasons.push(`Priced similarly to your previous bookings`);
    }

    if (profile.preferences.locations.some(loc => 
        space.address.toLowerCase().includes(loc.toLowerCase()))) {
      reasons.push(`In your preferred location`);
    }

    return reasons;
  }

  private generateRankingFactors(space: any, query: string, profile: RenterProfile): string[] {
    const factors: string[] = [];

    const queryWords = query.toLowerCase().split(' ');
    const spaceText = `${space.title} ${space.description}`.toLowerCase();
    const matchingWords = queryWords.filter(word => spaceText.includes(word));
    
    if (matchingWords.length > 0) {
      factors.push(`Contains ${matchingWords.length} search terms`);
    }

    if (profile.preferences.spaceTypes.includes(space.space_type)) {
      factors.push('Matches your space type preferences');
    }

    if (space.price_per_hour >= profile.preferences.priceRange.min && 
        space.price_per_hour <= profile.preferences.priceRange.max) {
      factors.push('Within your price range');
    }

    return factors;
  }

  private generatePersonalizedMessage(space: any, profile: RenterProfile): string {
    const messages = [
      `Based on your booking history, this ${space.space_type} looks perfect for you!`,
      `This space matches your preferences and is priced competitively.`,
      `We think you'll love this ${space.space_type} based on your past bookings.`,
      `This space is similar to others you've booked and enjoyed.`
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  private calculateUrgency(space: any, profile: RenterProfile): 'low' | 'medium' | 'high' {
    // Simple urgency calculation based on price and availability
    if (space.price_per_hour < profile.preferences.priceRange.min * 0.8) {
      return 'high'; // Great deal
    } else if (space.price_per_hour > profile.preferences.priceRange.max * 1.2) {
      return 'low'; // Expensive
    } else {
      return 'medium';
    }
  }

  private suggestOptimalPrice(space: any, preferences: any): number {
    // Suggest price within user's range
    const userMax = preferences.price_range_max || 100;
    return Math.min(space.price_per_hour, userMax);
  }

  private calculateConfidence(space: any, preferences: any): number {
    let confidence = 0;
    let factors = 0;

    if (preferences.space_type_preferences?.includes(space.space_type)) {
      confidence += 0.3;
    }
    factors++;

    if (space.price_per_hour >= preferences.price_range_min && 
        space.price_per_hour <= preferences.price_range_max) {
      confidence += 0.3;
    }
    factors++;

    if (preferences.location_preferences?.some((loc: string) => 
        space.address.toLowerCase().includes(loc.toLowerCase()))) {
      confidence += 0.4;
    }
    factors++;

    return factors > 0 ? confidence / factors : 0.5;
  }

  private analyzeBehaviorPatterns(preferences: any, bookingHistory: BookingHistory[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Price sensitivity analysis
    if (bookingHistory.length > 0) {
      const avgPrice = bookingHistory.reduce((sum, booking) => sum + booking.price, 0) / bookingHistory.length;
      const priceVariance = bookingHistory.reduce((sum, booking) => sum + Math.pow(booking.price - avgPrice, 2), 0) / bookingHistory.length;
      
      patterns.push({
        patternType: 'price_sensitivity',
        data: { averagePrice: avgPrice, variance: priceVariance },
        confidence: Math.min(bookingHistory.length / 10, 1)
      });
    }

    // Booking timing analysis
    const bookingTimes = bookingHistory.map(booking => new Date(booking.bookingDate).getHours());
    const peakHours = this.findPeaks(bookingTimes, 3);
    
    patterns.push({
      patternType: 'booking_timing',
      data: { peakHours },
      confidence: Math.min(bookingHistory.length / 5, 1)
    });

    return patterns;
  }

  private findPeaks(array: number[], count: number): number[] {
    const frequency: Record<number, number> = {};
    array.forEach(hour => {
      frequency[hour] = (frequency[hour] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, count)
      .map(([hour]) => parseInt(hour));
  }

  // AI enhancement methods
  private async aiEnhanceMatches(matches: SpaceMatch[], profile: RenterProfile, spaces: any[]): Promise<SpaceMatch[]> {
    // Implementation would use OpenAI to enhance match reasoning
    // For now, return the matches as-is
    return matches;
  }

  private async aiEnhanceRecommendations(recommendations: SpaceRecommendation[], profile: RenterProfile, spaces: any[]): Promise<SpaceRecommendation[]> {
    // Implementation would use OpenAI to enhance recommendation messages
    // For now, return the recommendations as-is
    return recommendations;
  }

  private async aiEnhanceRanking(rankedSpaces: RankedSpace[], query: string, profile: RenterProfile, spaces: any[]): Promise<RankedSpace[]> {
    // Implementation would use OpenAI to enhance ranking factors
    // For now, return the ranking as-is
    return rankedSpaces;
  }
}

export const smartMatchingService = new SmartMatchingService();
