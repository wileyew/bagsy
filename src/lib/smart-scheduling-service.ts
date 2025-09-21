import { supabase } from "@/integrations/supabase/client";
import { createComponentDebugger } from "./debug-utils";
import { openaiRequestManager } from './openai-request-manager';

const debug = createComponentDebugger('SmartSchedulingService');

export interface BookingData {
  id: string;
  spaceId: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
}

export interface AvailabilityWindow {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startHour: number; // 0-23
  endHour: number; // 0-23
  demandLevel: 'low' | 'medium' | 'high';
  suggestedPrice: number;
  confidence: number; // 0-1
}

export interface DemandForecast {
  date: string;
  expectedDemand: number; // 0-1 scale
  optimalPrice: number;
  confidence: number;
  factors: string[];
}

export interface PricingAdjustment {
  timeSlot: string;
  currentPrice: number;
  suggestedPrice: number;
  adjustmentReason: string;
  confidence: number;
}

export interface SpaceScheduleData {
  spaceId: string;
  optimalHours: AvailabilityWindow[];
  demandPatterns: Record<string, number>;
  pricingAdjustments: PricingAdjustment[];
  availabilityWindows: AvailabilityWindow[];
}

class SmartSchedulingService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  /**
   * Analyze booking patterns and suggest optimal availability windows
   */
  async suggestOptimalAvailability(spaceId: string, historicalData: BookingData[]): Promise<AvailabilityWindow[]> {
    debug.info('Analyzing booking patterns for optimal availability', { spaceId, bookingCount: historicalData.length });

    try {
      // Get space details
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', spaceId)
        .single();

      if (spaceError || !space) {
        throw new Error(`Space not found: ${spaceError?.message}`);
      }

      // Analyze booking patterns
      const patterns = this.analyzeBookingPatterns(historicalData);
      
      // Use AI to suggest optimal windows if API key is available
      if (this.apiKey) {
        return await this.aiSuggestAvailability(space, patterns);
      } else {
        return this.fallbackAvailabilitySuggestions(patterns);
      }
    } catch (error) {
      debug.error('Failed to suggest optimal availability', error);
      throw error;
    }
  }

  /**
   * Predict demand patterns for dynamic pricing
   */
  async predictDemandPatterns(location: string, spaceType: string, timeframe: { start: string; end: string }): Promise<DemandForecast[]> {
    debug.info('Predicting demand patterns', { location, spaceType, timeframe });

    try {
      // Get historical data for similar spaces in the area
      const { data: similarSpaces, error: spacesError } = await supabase
        .from('spaces')
        .select('id, space_type, address, zip_code')
        .eq('space_type', spaceType)
        .ilike('address', `%${location}%`)
        .eq('is_active', true);

      if (spacesError) {
        throw new Error(`Failed to fetch similar spaces: ${spacesError.message}`);
      }

      // Get booking data for similar spaces
      const spaceIds = similarSpaces?.map(s => s.id) || [];
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .in('space_id', spaceIds)
        .gte('start_time', timeframe.start)
        .lte('end_time', timeframe.end)
        .eq('status', 'confirmed');

      if (bookingsError) {
        throw new Error(`Failed to fetch booking data: ${bookingsError.message}`);
      }

      // Analyze demand patterns
      const demandData = this.analyzeDemandPatterns(bookings || [], timeframe);
      
      // Use AI for prediction if available
      if (this.apiKey) {
        return await this.aiPredictDemand(location, spaceType, demandData);
      } else {
        return this.fallbackDemandPrediction(demandData);
      }
    } catch (error) {
      debug.error('Failed to predict demand patterns', error);
      throw error;
    }
  }

  /**
   * Auto-adjust pricing based on demand
   */
  async adjustPricingForDemand(spaceId: string, currentBookings: BookingData[]): Promise<PricingAdjustment[]> {
    debug.info('Adjusting pricing based on demand', { spaceId, bookingCount: currentBookings.length });

    try {
      const { data: space, error: spaceError } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', spaceId)
        .single();

      if (spaceError || !space) {
        throw new Error(`Space not found: ${spaceError?.message}`);
      }

      // Analyze current demand
      const demandAnalysis = this.analyzeCurrentDemand(currentBookings);
      
      // Generate pricing adjustments
      const adjustments = this.generatePricingAdjustments(space, demandAnalysis);
      
      // Store adjustments in database
      await this.storePricingAdjustments(spaceId, adjustments);
      
      return adjustments;
    } catch (error) {
      debug.error('Failed to adjust pricing for demand', error);
      throw error;
    }
  }

  /**
   * Store smart scheduling data
   */
  async storeSmartSchedulingData(spaceId: string, data: SpaceScheduleData): Promise<void> {
    debug.info('Storing smart scheduling data', { spaceId });

    try {
      const { error } = await supabase
        .from('smart_scheduling')
        .upsert({
          space_id: spaceId,
          optimal_hours: data.optimalHours,
          demand_patterns: data.demandPatterns,
          pricing_adjustments: data.pricingAdjustments,
          availability_windows: data.availabilityWindows,
          last_updated: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Failed to store scheduling data: ${error.message}`);
      }

      debug.info('Smart scheduling data stored successfully');
    } catch (error) {
      debug.error('Failed to store smart scheduling data', error);
      throw error;
    }
  }

  /**
   * Get smart scheduling data for a space
   */
  async getSmartSchedulingData(spaceId: string): Promise<SpaceScheduleData | null> {
    debug.info('Retrieving smart scheduling data', { spaceId });

    try {
      const { data, error } = await supabase
        .from('smart_scheduling')
        .select('*')
        .eq('space_id', spaceId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to retrieve scheduling data: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return {
        spaceId: data.space_id,
        optimalHours: data.optimal_hours || [],
        demandPatterns: data.demand_patterns || {},
        pricingAdjustments: data.pricing_adjustments || [],
        availabilityWindows: data.availability_windows || []
      };
    } catch (error) {
      debug.error('Failed to retrieve smart scheduling data', error);
      throw error;
    }
  }

  // Private helper methods

  private analyzeBookingPatterns(bookings: BookingData[]): Record<string, any> {
    const patterns = {
      hourlyDistribution: new Array(24).fill(0),
      dailyDistribution: new Array(7).fill(0),
      monthlyDistribution: new Array(12).fill(0),
      averageDuration: 0,
      peakHours: [] as number[],
      peakDays: [] as number[]
    };

    bookings.forEach(booking => {
      const startTime = new Date(booking.startTime);
      const endTime = new Date(booking.endTime);
      
      // Hourly distribution
      patterns.hourlyDistribution[startTime.getHours()]++;
      
      // Daily distribution
      patterns.dailyDistribution[startTime.getDay()]++;
      
      // Monthly distribution
      patterns.monthlyDistribution[startTime.getMonth()]++;
      
      // Duration
      patterns.averageDuration += (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    });

    // Calculate averages
    patterns.averageDuration = patterns.averageDuration / bookings.length;
    
    // Find peaks (top 3 hours/days)
    patterns.peakHours = this.findPeaks(patterns.hourlyDistribution, 3);
    patterns.peakDays = this.findPeaks(patterns.dailyDistribution, 3);

    return patterns;
  }

  private analyzeDemandPatterns(bookings: any[], timeframe: { start: string; end: string }): Record<string, any> {
    const demandData = {
      totalBookings: bookings.length,
      averagePrice: 0,
      priceRange: { min: Infinity, max: -Infinity },
      seasonalTrends: {},
      locationFactors: []
    };

    if (bookings.length === 0) {
      return demandData;
    }

    let totalPrice = 0;
    bookings.forEach(booking => {
      totalPrice += booking.total_price;
      demandData.priceRange.min = Math.min(demandData.priceRange.min, booking.total_price);
      demandData.priceRange.max = Math.max(demandData.priceRange.max, booking.total_price);
    });

    demandData.averagePrice = totalPrice / bookings.length;

    return demandData;
  }

  private analyzeCurrentDemand(bookings: BookingData[]): Record<string, any> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();
    
    const recentBookings = bookings.filter(booking => {
      const bookingTime = new Date(booking.startTime);
      const timeDiff = now.getTime() - bookingTime.getTime();
      return timeDiff <= 7 * 24 * 60 * 60 * 1000; // Last 7 days
    });

    return {
      currentHour,
      currentDay,
      recentBookings: recentBookings.length,
      averageBookingFrequency: recentBookings.length / 7,
      demandLevel: this.calculateDemandLevel(recentBookings.length)
    };
  }

  private calculateDemandLevel(bookingCount: number): 'low' | 'medium' | 'high' {
    if (bookingCount < 3) return 'low';
    if (bookingCount < 7) return 'medium';
    return 'high';
  }

  private generatePricingAdjustments(space: any, demandAnalysis: any): PricingAdjustment[] {
    const adjustments: PricingAdjustment[] = [];
    const basePrice = space.price_per_hour;

    // Peak hour adjustments
    if (demandAnalysis.demandLevel === 'high') {
      adjustments.push({
        timeSlot: 'peak_hours',
        currentPrice: basePrice,
        suggestedPrice: basePrice * 1.2,
        adjustmentReason: 'High demand detected - premium pricing recommended',
        confidence: 0.8
      });
    } else if (demandAnalysis.demandLevel === 'low') {
      adjustments.push({
        timeSlot: 'off_peak_hours',
        currentPrice: basePrice,
        suggestedPrice: basePrice * 0.9,
        adjustmentReason: 'Low demand detected - competitive pricing recommended',
        confidence: 0.7
      });
    }

    return adjustments;
  }

  private async storePricingAdjustments(spaceId: string, adjustments: PricingAdjustment[]): Promise<void> {
    const { error } = await supabase
      .from('ai_analytics')
      .insert({
        space_id: spaceId,
        analytics_type: 'pricing_optimization',
        data: { adjustments },
        confidence_score: adjustments.reduce((sum, adj) => sum + adj.confidence, 0) / adjustments.length
      });

    if (error) {
      debug.error('Failed to store pricing adjustments', error);
    }
  }

  private async aiSuggestAvailability(space: any, patterns: any): Promise<AvailabilityWindow[]> {
    // Check if requests are allowed using centralized manager
    const requestCheck = openaiRequestManager.canMakeRequest();
    if (!requestCheck.allowed) {
      debug.warn('OpenAI request blocked for availability suggestions:', requestCheck.reason);
      return this.fallbackAvailabilitySuggestions(patterns);
    }

    // Reserve request slot using centralized manager
    const reserved = openaiRequestManager.reserveRequest();
    if (!reserved) {
      debug.warn('Failed to reserve OpenAI request slot for availability suggestions');
      return this.fallbackAvailabilitySuggestions(patterns);
    }

    const prompt = `Analyze the following booking patterns for a ${space.space_type} space and suggest optimal availability windows:

BOOKING PATTERNS:
- Peak Hours: ${patterns.peakHours.join(', ')}
- Peak Days: ${patterns.peakDays.join(', ')}
- Average Duration: ${patterns.averageDuration.toFixed(1)} hours
- Hourly Distribution: ${patterns.hourlyDistribution.join(', ')}

SPACE DETAILS:
- Type: ${space.space_type}
- Location: ${space.address}
- Current Price: $${space.price_per_hour}/hour

Suggest 5-7 optimal availability windows with:
1. Day of week (0-6, Sunday-Saturday)
2. Start hour (0-23)
3. End hour (0-23)
4. Demand level (low/medium/high)
5. Suggested price multiplier (0.8-1.3)
6. Confidence score (0-1)

Return as JSON array with fields: dayOfWeek, startHour, endHour, demandLevel, suggestedPrice, confidence`;

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
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No availability suggestions from OpenAI');
      }

      const suggestions = JSON.parse(content);
      return suggestions.map((suggestion: any) => ({
        dayOfWeek: suggestion.dayOfWeek,
        startHour: suggestion.startHour,
        endHour: suggestion.endHour,
        demandLevel: suggestion.demandLevel,
        suggestedPrice: space.price_per_hour * suggestion.suggestedPrice,
        confidence: suggestion.confidence
      }));
    } catch (error) {
      debug.error('AI availability suggestion failed', error);
      return this.fallbackAvailabilitySuggestions(patterns);
    }
  }

  private async aiPredictDemand(location: string, spaceType: string, demandData: any): Promise<DemandForecast[]> {
    // Check if requests are allowed using centralized manager
    const requestCheck = openaiRequestManager.canMakeRequest();
    if (!requestCheck.allowed) {
      debug.warn('OpenAI request blocked for demand prediction:', requestCheck.reason);
      return this.fallbackDemandPrediction(demandData);
    }

    // Reserve request slot using centralized manager
    const reserved = openaiRequestManager.reserveRequest();
    if (!reserved) {
      debug.warn('Failed to reserve OpenAI request slot for demand prediction');
      return this.fallbackDemandPrediction(demandData);
    }

    const prompt = `Predict demand patterns for a ${spaceType} space in ${location}:

MARKET DATA:
- Total Bookings: ${demandData.totalBookings}
- Average Price: $${demandData.averagePrice?.toFixed(2) || 'N/A'}
- Price Range: $${demandData.priceRange?.min || 'N/A'} - $${demandData.priceRange?.max || 'N/A'}

Predict demand for the next 7 days with:
1. Date (YYYY-MM-DD)
2. Expected demand (0-1 scale)
3. Optimal price
4. Confidence (0-1)
5. Key factors affecting demand

Return as JSON array with fields: date, expectedDemand, optimalPrice, confidence, factors`;

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
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No demand prediction from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      debug.error('AI demand prediction failed', error);
      return this.fallbackDemandPrediction(demandData);
    }
  }

  private fallbackAvailabilitySuggestions(patterns: any): AvailabilityWindow[] {
    const suggestions: AvailabilityWindow[] = [];
    
    // Suggest peak hours as optimal windows
    patterns.peakHours.forEach((hour: number) => {
      suggestions.push({
        dayOfWeek: patterns.peakDays[0] || 1, // Default to Monday
        startHour: hour,
        endHour: hour + 2,
        demandLevel: 'high',
        suggestedPrice: 10, // Default price
        confidence: 0.7
      });
    });

    return suggestions;
  }

  private fallbackDemandPrediction(demandData: any): DemandForecast[] {
    const forecasts: DemandForecast[] = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      forecasts.push({
        date: date.toISOString().split('T')[0],
        expectedDemand: Math.random() * 0.5 + 0.3, // Random between 0.3-0.8
        optimalPrice: demandData.averagePrice || 10,
        confidence: 0.6,
        factors: ['Historical patterns', 'Seasonal trends']
      });
    }

    return forecasts;
  }

  private findPeaks(array: number[], count: number): number[] {
    const indexed = array.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => b.value - a.value);
    return indexed.slice(0, count).map(item => item.index);
  }
}

export const smartSchedulingService = new SmartSchedulingService();
