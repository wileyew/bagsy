import { createComponentDebugger } from "./debug-utils";

const debug = createComponentDebugger('AIRecommendationsService');

export interface UserProfile {
  userId: string;
  preferences: {
    spaceTypes: string[];
    priceRange: { min: number; max: number };
    locations: string[];
    amenities: string[];
  };
  searchHistory: string[];
  bookingHistory: Array<{
    spaceType: string;
    price: number;
    location: string;
    rating?: number;
  }>;
  behaviorPatterns: {
    frequency: 'low' | 'medium' | 'high';
    priceSensitivity: 'low' | 'medium' | 'high';
    locationPreference: 'local' | 'flexible' | 'specific';
  };
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  features: string[];
  reasoning: string;
  confidence: number; // 0-1
  estimatedImpact: 'low' | 'medium' | 'high';
  category: 'pricing' | 'marketing' | 'scheduling' | 'analytics' | 'webscraping';
}

export interface PersonalizedRecommendations {
  userId: string;
  recommendations: AIRecommendation[];
  topRecommendation: AIRecommendation;
  summary: string;
  generatedAt: string;
}

class AIRecommendationsService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  /**
   * Generate personalized AI recommendations based on user profile
   */
  async generatePersonalizedRecommendations(userProfile: UserProfile): Promise<PersonalizedRecommendations> {
    debug.info('Generating personalized AI recommendations', { userId: userProfile.userId });

    try {
      if (this.apiKey) {
        return await this.aiGenerateRecommendations(userProfile);
      } else {
        return this.fallbackRecommendations(userProfile);
      }
    } catch (error) {
      debug.error('Failed to generate personalized recommendations', error);
      return this.fallbackRecommendations(userProfile);
    }
  }

  /**
   * Get quick recommendation based on user behavior
   */
  async getQuickRecommendation(userProfile: Partial<UserProfile>): Promise<AIRecommendation> {
    debug.info('Getting quick recommendation', { userId: userProfile.userId });

    // Analyze user behavior patterns
    const analysis = this.analyzeUserBehavior(userProfile);
    
    // Generate recommendation based on analysis
    const recommendation = this.generateRecommendationFromAnalysis(analysis);
    
    debug.info('Quick recommendation generated', recommendation);
    return recommendation;
  }

  /**
   * Get recommendations for specific space type
   */
  async getSpaceTypeRecommendations(spaceType: string, userProfile: Partial<UserProfile>): Promise<AIRecommendation[]> {
    debug.info('Getting space type recommendations', { spaceType, userId: userProfile.userId });

    const recommendations: AIRecommendation[] = [];

    // Pricing optimization recommendation
    if (this.shouldRecommendPricing(spaceType, userProfile)) {
      recommendations.push({
        id: 'pricing-optimization',
        title: 'AI-Powered Pricing Optimization',
        description: 'Automatically adjust your pricing based on market demand, seasonal trends, and competitor analysis.',
        features: [
          'Dynamic pricing adjustments',
          'Peak hour pricing strategies',
          'Seasonal demand analysis',
          'Competitive positioning'
        ],
        reasoning: 'Your space type shows high price sensitivity in your area. AI pricing optimization can increase revenue by 15-25%.',
        confidence: 0.85,
        estimatedImpact: 'high',
        category: 'pricing'
      });
    }

    // Marketing content recommendation
    if (this.shouldRecommendMarketing(spaceType, userProfile)) {
      recommendations.push({
        id: 'marketing-content',
        title: 'AI-Generated Marketing Content',
        description: 'Create compelling SEO-optimized listings, social media posts, and email campaigns automatically.',
        features: [
          'SEO-optimized titles and descriptions',
          'Social media marketing posts',
          'Email campaign templates',
          'Listing optimization suggestions'
        ],
        reasoning: 'Your location has high competition. Professional marketing content can improve visibility by 40-60%.',
        confidence: 0.78,
        estimatedImpact: 'high',
        category: 'marketing'
      });
    }

    // Smart scheduling recommendation
    if (this.shouldRecommendScheduling(spaceType, userProfile)) {
      recommendations.push({
        id: 'smart-scheduling',
        title: 'AI-Powered Smart Scheduling',
        description: 'Optimize your availability windows and pricing based on demand patterns and booking history.',
        features: [
          'Optimal availability windows',
          'Demand pattern analysis',
          'Peak hour identification',
          'Revenue optimization scheduling'
        ],
        reasoning: 'Your space type shows predictable demand patterns. Smart scheduling can increase utilization by 20-30%.',
        confidence: 0.72,
        estimatedImpact: 'medium',
        category: 'scheduling'
      });
    }

    // Web scraping recommendation
    if (this.shouldRecommendWebScraping(spaceType, userProfile)) {
      recommendations.push({
        id: 'web-scraping',
        title: 'Market Research via Web Scraping',
        description: 'Automatically research competitor pricing and market trends to stay competitive.',
        features: [
          'Competitor pricing analysis',
          'Market trend identification',
          'Pricing recommendations',
          'Competitive advantages'
        ],
        reasoning: 'Your area has active competition. Market research helps you stay competitive and price optimally.',
        confidence: 0.80,
        estimatedImpact: 'medium',
        category: 'webscraping'
      });
    }

    // Predictive analytics recommendation
    if (this.shouldRecommendAnalytics(spaceType, userProfile)) {
      recommendations.push({
        id: 'predictive-analytics',
        title: 'Predictive Analytics & Insights',
        description: 'Get advanced analytics including revenue forecasting and performance insights.',
        features: [
          'Revenue potential forecasting',
          'Market trend predictions',
          'Booking pattern analysis',
          'Performance optimization insights'
        ],
        reasoning: 'You have sufficient data for meaningful predictions. Analytics can help optimize your strategy.',
        confidence: 0.70,
        estimatedImpact: 'medium',
        category: 'analytics'
      });
    }

    debug.info('Space type recommendations generated', { 
      spaceType, 
      recommendationCount: recommendations.length 
    });

    return recommendations;
  }

  // Private helper methods

  private async aiGenerateRecommendations(userProfile: UserProfile): Promise<PersonalizedRecommendations> {
    const prompt = `Generate personalized AI recommendations for a space rental platform user:

USER PROFILE:
- User ID: ${userProfile.userId}
- Preferred Space Types: ${userProfile.preferences.spaceTypes.join(', ')}
- Price Range: $${userProfile.preferences.priceRange.min}-$${userProfile.preferences.priceRange.max}
- Locations: ${userProfile.preferences.locations.join(', ')}
- Search History: ${userProfile.searchHistory.slice(0, 5).join(', ')}
- Booking History: ${userProfile.bookingHistory.length} bookings
- Behavior: ${userProfile.behaviorPatterns.frequency} frequency, ${userProfile.behaviorPatterns.priceSensitivity} price sensitivity

AVAILABLE AI FEATURES:
1. Pricing Optimization - Dynamic pricing based on demand
2. Marketing Content - AI-generated SEO content and social media posts
3. Smart Scheduling - Optimal availability windows
4. Web Scraping - Market research and competitor analysis
5. Predictive Analytics - Revenue forecasting and insights

Generate 3-5 personalized recommendations with:
- Title and description
- Key features (3-4 items)
- Reasoning based on user profile
- Confidence score (0-1)
- Estimated impact (low/medium/high)
- Category (pricing/marketing/scheduling/analytics/webscraping)

Return as JSON with fields: recommendations, topRecommendation, summary`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No recommendations from OpenAI');
      }

      const result = JSON.parse(content);
      
      return {
        userId: userProfile.userId,
        recommendations: result.recommendations,
        topRecommendation: result.topRecommendation,
        summary: result.summary,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      debug.error('AI recommendation generation failed', error);
      throw error;
    }
  }

  private fallbackRecommendations(userProfile: UserProfile): PersonalizedRecommendations {
    const recommendations: AIRecommendation[] = [
      {
        id: 'pricing-optimization',
        title: 'AI-Powered Pricing Optimization',
        description: 'Automatically adjust your pricing based on market demand and competitor analysis.',
        features: [
          'Dynamic pricing adjustments',
          'Peak hour pricing strategies',
          'Seasonal demand analysis',
          'Competitive positioning'
        ],
        reasoning: 'Based on your profile, pricing optimization can help maximize revenue.',
        confidence: 0.75,
        estimatedImpact: 'high',
        category: 'pricing'
      },
      {
        id: 'marketing-content',
        title: 'AI-Generated Marketing Content',
        description: 'Create compelling SEO-optimized listings and social media content.',
        features: [
          'SEO-optimized titles and descriptions',
          'Social media marketing posts',
          'Email campaign templates',
          'Listing optimization suggestions'
        ],
        reasoning: 'Professional marketing content can improve your listing visibility.',
        confidence: 0.70,
        estimatedImpact: 'medium',
        category: 'marketing'
      }
    ];

    return {
      userId: userProfile.userId,
      recommendations,
      topRecommendation: recommendations[0],
      summary: 'AI-powered features to optimize your space rental strategy.',
      generatedAt: new Date().toISOString()
    };
  }

  private analyzeUserBehavior(userProfile: Partial<UserProfile>): any {
    return {
      isFrequentUser: userProfile.behaviorPatterns?.frequency === 'high',
      isPriceSensitive: userProfile.behaviorPatterns?.priceSensitivity === 'high',
      hasLocationPreference: userProfile.behaviorPatterns?.locationPreference === 'specific',
      hasBookingHistory: (userProfile.bookingHistory?.length || 0) > 0,
      hasSearchHistory: (userProfile.searchHistory?.length || 0) > 0
    };
  }

  private generateRecommendationFromAnalysis(analysis: any): AIRecommendation {
    if (analysis.isPriceSensitive) {
      return {
        id: 'pricing-optimization',
        title: 'AI-Powered Pricing Optimization',
        description: 'Optimize your pricing strategy to maximize revenue while staying competitive.',
        features: [
          'Dynamic pricing adjustments',
          'Market-based pricing',
          'Competitive analysis',
          'Revenue optimization'
        ],
        reasoning: 'You\'re price-sensitive, so AI pricing optimization can help you find the sweet spot.',
        confidence: 0.85,
        estimatedImpact: 'high',
        category: 'pricing'
      };
    }

    return {
      id: 'marketing-content',
      title: 'AI-Generated Marketing Content',
      description: 'Create professional marketing content to attract more renters.',
      features: [
        'SEO-optimized listings',
        'Social media content',
        'Email campaigns',
        'Listing optimization'
      ],
      reasoning: 'Professional marketing content can help you stand out from competitors.',
      confidence: 0.75,
      estimatedImpact: 'medium',
      category: 'marketing'
    };
  }

  private shouldRecommendPricing(spaceType: string, userProfile: Partial<UserProfile>): boolean {
    // Recommend pricing optimization for high-value space types
    const highValueTypes = ['warehouse', 'rv_storage', 'storage_unit'];
    return highValueTypes.includes(spaceType) || userProfile.behaviorPatterns?.priceSensitivity === 'high';
  }

  private shouldRecommendMarketing(spaceType: string, userProfile: Partial<UserProfile>): boolean {
    // Recommend marketing for competitive areas
    return userProfile.preferences?.locations.length > 0 || userProfile.behaviorPatterns?.frequency === 'high';
  }

  private shouldRecommendScheduling(spaceType: string, userProfile: Partial<UserProfile>): boolean {
    // Recommend scheduling for space types with predictable demand
    const predictableTypes = ['garage', 'driveway', 'parking_spot'];
    return predictableTypes.includes(spaceType);
  }

  private shouldRecommendWebScraping(spaceType: string, userProfile: Partial<UserProfile>): boolean {
    // Recommend web scraping for competitive markets
    return userProfile.preferences?.locations.length > 0;
  }

  private shouldRecommendAnalytics(spaceType: string, userProfile: Partial<UserProfile>): boolean {
    // Recommend analytics for users with booking history
    return (userProfile.bookingHistory?.length || 0) > 0;
  }
}

export const aiRecommendationsService = new AIRecommendationsService();
