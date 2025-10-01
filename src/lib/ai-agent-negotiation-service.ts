import { createComponentDebugger } from "./debug-utils";
import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "./notification-service";

const debug = createComponentDebugger('AIAgentNegotiationService');

interface NegotiationContext {
  spaceId: string;
  ownerId: string;
  renterId: string;
  bookingId: string;
  originalPrice: number;
  currentOffer: number;
  listingData: any;
  negotiationHistory: any[];
  ownerPreferences?: AIAgentPreferences;
  renterPreferences?: AIAgentPreferences;
}

interface AIAgentPreferences {
  enabled: boolean;
  minAcceptablePrice?: number;
  maxAcceptablePrice?: number;
  autoAcceptThreshold?: number; // Percentage difference from listing price
  negotiationStrategy?: 'aggressive' | 'moderate' | 'conservative';
  maxCounterOffers?: number;
}

interface MarketData {
  averagePrice: number;
  medianPrice: number;
  priceRange: { min: number; max: number };
  competitorCount: number;
  demandLevel: 'low' | 'medium' | 'high';
  seasonalFactor: number;
}

interface NegotiationDecision {
  action: 'accept' | 'reject' | 'counter';
  counterPrice?: number;
  reasoning: string;
  confidence: number; // 0-1 scale
  aiGenerated: boolean;
}

class AIAgentNegotiationService {
  /**
   * Process a negotiation offer with AI agent if enabled
   */
  async processNegotiationWithAI(context: NegotiationContext): Promise<NegotiationDecision | null> {
    debug.info('Processing negotiation with AI', context);

    try {
      // Check if AI agent should handle this
      const shouldUseAI = this.shouldUseAIAgent(context);
      
      if (!shouldUseAI) {
        debug.info('AI agent not enabled for this negotiation');
        return null;
      }

      // Determine which side's AI is responding
      const isOwnerAI = context.ownerPreferences?.enabled || false;
      const isRenterAI = context.renterPreferences?.enabled || false;

      debug.info('AI agent status', { isOwnerAI, isRenterAI });

      // Get market data for intelligent pricing
      const marketData = await this.getMarketData(context);

      // Make AI decision
      const decision = isOwnerAI 
        ? await this.makeOwnerAIDecision(context, marketData)
        : await this.makeRenterAIDecision(context, marketData);

      debug.info('AI decision made', decision);

      // Execute the decision
      await this.executeAIDecision(context, decision);

      return decision;
    } catch (error) {
      debug.error('AI negotiation processing failed', error);
      return null;
    }
  }

  /**
   * Owner AI decision logic
   */
  private async makeOwnerAIDecision(
    context: NegotiationContext,
    marketData: MarketData
  ): Promise<NegotiationDecision> {
    const { originalPrice, currentOffer, ownerPreferences, negotiationHistory } = context;
    const strategy = ownerPreferences?.negotiationStrategy || 'moderate';
    const minPrice = ownerPreferences?.minAcceptablePrice || originalPrice * 0.7;
    const autoAcceptThreshold = ownerPreferences?.autoAcceptThreshold || 0.95;

    // Calculate offer ratio
    const offerRatio = currentOffer / originalPrice;
    const marketRatio = currentOffer / marketData.averagePrice;

    debug.debug('Owner AI analysis', {
      offerRatio,
      marketRatio,
      minPrice,
      currentOffer,
      strategy
    });

    // Decision logic based on offer quality
    
    // 1. Accept if offer is close to or above asking price
    if (offerRatio >= autoAcceptThreshold) {
      return {
        action: 'accept',
        reasoning: `Offer of $${currentOffer.toFixed(2)}/hr is ${(offerRatio * 100).toFixed(0)}% of listing price. Excellent deal!`,
        confidence: 0.95,
        aiGenerated: true
      };
    }

    // 2. Accept if offer is above market average and reasonable
    if (currentOffer >= marketData.averagePrice && offerRatio >= 0.85) {
      return {
        action: 'accept',
        reasoning: `Offer exceeds market average of $${marketData.averagePrice.toFixed(2)}/hr. Good market value.`,
        confidence: 0.85,
        aiGenerated: true
      };
    }

    // 3. Reject if below minimum acceptable price
    if (currentOffer < minPrice) {
      return {
        action: 'reject',
        reasoning: `Offer of $${currentOffer.toFixed(2)}/hr is below minimum acceptable price of $${minPrice.toFixed(2)}/hr.`,
        confidence: 0.9,
        aiGenerated: true
      };
    }

    // 4. Counter-offer logic based on strategy
    const counterPrice = this.calculateOwnerCounterOffer(
      originalPrice,
      currentOffer,
      minPrice,
      marketData,
      strategy,
      negotiationHistory.length
    );

    return {
      action: 'counter',
      counterPrice,
      reasoning: this.generateOwnerCounterReasoning(
        counterPrice,
        currentOffer,
        marketData,
        strategy
      ),
      confidence: 0.75,
      aiGenerated: true
    };
  }

  /**
   * Renter AI decision logic
   */
  private async makeRenterAIDecision(
    context: NegotiationContext,
    marketData: MarketData
  ): Promise<NegotiationDecision> {
    const { originalPrice, currentOffer, renterPreferences, negotiationHistory } = context;
    const strategy = renterPreferences?.negotiationStrategy || 'moderate';
    const maxPrice = renterPreferences?.maxAcceptablePrice || originalPrice * 1.1;

    // For renter, currentOffer is the owner's counter-offer they're responding to
    const offerRatio = currentOffer / originalPrice;
    const marketRatio = currentOffer / marketData.averagePrice;

    debug.debug('Renter AI analysis', {
      offerRatio,
      marketRatio,
      maxPrice,
      currentOffer,
      strategy
    });

    // 1. Accept if price is at or below budget and reasonable
    if (currentOffer <= maxPrice && marketRatio <= 1.1) {
      return {
        action: 'accept',
        reasoning: `Price of $${currentOffer.toFixed(2)}/hr is within budget and ${marketRatio <= 1.0 ? 'at or below' : 'close to'} market average.`,
        confidence: 0.9,
        aiGenerated: true
      };
    }

    // 2. Accept if significantly below market average
    if (currentOffer < marketData.averagePrice * 0.85) {
      return {
        action: 'accept',
        reasoning: `Excellent deal! Price is ${((1 - currentOffer / marketData.averagePrice) * 100).toFixed(0)}% below market average.`,
        confidence: 0.95,
        aiGenerated: true
      };
    }

    // 3. Reject if way above budget
    if (currentOffer > maxPrice * 1.15) {
      return {
        action: 'reject',
        reasoning: `Price of $${currentOffer.toFixed(2)}/hr exceeds maximum budget of $${maxPrice.toFixed(2)}/hr.`,
        confidence: 0.9,
        aiGenerated: true
      };
    }

    // 4. Counter-offer logic
    const counterPrice = this.calculateRenterCounterOffer(
      originalPrice,
      currentOffer,
      maxPrice,
      marketData,
      strategy,
      negotiationHistory.length
    );

    return {
      action: 'counter',
      counterPrice,
      reasoning: this.generateRenterCounterReasoning(
        counterPrice,
        currentOffer,
        marketData,
        strategy
      ),
      confidence: 0.75,
      aiGenerated: true
    };
  }

  /**
   * Calculate owner's counter-offer
   */
  private calculateOwnerCounterOffer(
    originalPrice: number,
    currentOffer: number,
    minPrice: number,
    marketData: MarketData,
    strategy: string,
    roundNumber: number
  ): number {
    // Base counter is midpoint between current offer and original price
    let counter = (currentOffer + originalPrice) / 2;

    // Adjust based on strategy
    switch (strategy) {
      case 'aggressive':
        // Stay closer to original price
        counter = currentOffer + (originalPrice - currentOffer) * 0.7;
        break;
      case 'conservative':
        // Move more toward renter's offer
        counter = currentOffer + (originalPrice - currentOffer) * 0.4;
        break;
      default: // moderate
        counter = (currentOffer + originalPrice) / 2;
    }

    // Adjust based on market data
    if (marketData.demandLevel === 'high') {
      counter *= 1.05; // Can ask for more in high demand
    } else if (marketData.demandLevel === 'low') {
      counter *= 0.95; // Be more flexible in low demand
    }

    // As negotiations progress, move closer to agreement
    const progressFactor = Math.min(roundNumber / 5, 0.3);
    counter = counter - (counter - currentOffer) * progressFactor;

    // Ensure counter is above minimum price
    counter = Math.max(counter, minPrice);

    // Round to 2 decimal places
    return Math.round(counter * 100) / 100;
  }

  /**
   * Calculate renter's counter-offer
   */
  private calculateRenterCounterOffer(
    originalPrice: number,
    ownerOffer: number,
    maxPrice: number,
    marketData: MarketData,
    strategy: string,
    roundNumber: number
  ): number {
    // Start with market average as baseline
    let counter = marketData.averagePrice;

    // Adjust based on strategy
    switch (strategy) {
      case 'aggressive':
        // Offer below market average
        counter = marketData.averagePrice * 0.85;
        break;
      case 'conservative':
        // Willing to pay closer to asking
        counter = (ownerOffer + marketData.averagePrice) / 2;
        break;
      default: // moderate
        counter = marketData.averagePrice * 0.95;
    }

    // Move toward owner's offer as negotiations progress
    const progressFactor = Math.min(roundNumber / 5, 0.4);
    counter = counter + (ownerOffer - counter) * progressFactor;

    // Ensure counter doesn't exceed max budget
    counter = Math.min(counter, maxPrice);

    // Round to 2 decimal places
    return Math.round(counter * 100) / 100;
  }

  /**
   * Generate reasoning for owner counter-offer
   */
  private generateOwnerCounterReasoning(
    counterPrice: number,
    currentOffer: number,
    marketData: MarketData,
    strategy: string
  ): string {
    const difference = counterPrice - currentOffer;
    const percentDiff = ((counterPrice / currentOffer - 1) * 100).toFixed(0);

    const reasons = [
      `Based on market analysis, comparable spaces average $${marketData.averagePrice.toFixed(2)}/hr.`,
      `My counter-offer of $${counterPrice.toFixed(2)}/hr is ${percentDiff}% above your offer.`,
      marketData.demandLevel === 'high' 
        ? `Demand is currently high in this area.`
        : marketData.demandLevel === 'low'
        ? `I'm being flexible given current market conditions.`
        : `This represents fair market value for the space.`,
      `Let's find a price that works for both of us.`
    ];

    return reasons.join(' ');
  }

  /**
   * Generate reasoning for renter counter-offer
   */
  private generateRenterCounterReasoning(
    counterPrice: number,
    ownerOffer: number,
    marketData: MarketData,
    strategy: string
  ): string {
    const difference = ownerOffer - counterPrice;
    const percentDiff = ((difference / ownerOffer) * 100).toFixed(0);

    const reasons = [
      `I've researched comparable spaces in the area averaging $${marketData.averagePrice.toFixed(2)}/hr.`,
      `My offer of $${counterPrice.toFixed(2)}/hr reflects fair market value.`,
      counterPrice >= marketData.averagePrice
        ? `This is already above the market average.`
        : `This is a competitive offer for similar spaces.`,
      `I'm ready to book immediately at this price.`
    ];

    return reasons.join(' ');
  }

  /**
   * Execute AI decision
   */
  private async executeAIDecision(
    context: NegotiationContext,
    decision: NegotiationDecision
  ): Promise<void> {
    const { bookingId, ownerId, renterId, negotiationHistory } = context;
    const latestNegotiation = negotiationHistory[0];

    if (decision.action === 'accept') {
      // Update the latest negotiation to accepted
      await supabase
        .from('negotiations')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('id', latestNegotiation.id);

      // Update booking
      await supabase
        .from('bookings')
        .update({
          status: 'accepted',
          final_price: context.currentOffer
        })
        .eq('id', bookingId);

      // Create agreement
      const { data: booking } = await supabase
        .from('bookings')
        .select('*, spaces(*)')
        .eq('id', bookingId)
        .single();

      if (booking) {
        const termsText = `
DRIVEWAY RENTAL AGREEMENT (AI-Negotiated)

Space: ${booking.spaces?.title || 'Space'}
Address: ${booking.spaces?.address || 'N/A'}

Rental Period:
From: ${new Date(booking.start_time).toLocaleString()}
To: ${new Date(booking.end_time).toLocaleString()}

Agreed Price: $${context.currentOffer.toFixed(2)} per hour
Total Amount: $${booking.total_price?.toFixed(2) || '0.00'}

This agreement was negotiated with AI assistance on behalf of both parties.
Both parties have reviewed and agree to these terms.

AI Decision Reasoning: ${decision.reasoning}
        `;

        const { data: agreement } = await supabase
          .from('agreements')
          .insert({
            booking_id: bookingId,
            renter_id: renterId,
            owner_id: ownerId,
            terms: termsText
          })
          .select()
          .single();

        if (agreement) {
          // Notify both parties
          await notificationService.notifyAgreementReady(renterId, bookingId, agreement.id);
          await notificationService.notifyAgreementReady(ownerId, bookingId, agreement.id);
        }
      }

    } else if (decision.action === 'counter' && decision.counterPrice) {
      // Create counter-offer
      const fromUserId = latestNegotiation.to_user_id; // The AI is responding
      const toUserId = latestNegotiation.from_user_id;

      await supabase
        .from('negotiations')
        .insert({
          booking_id: bookingId,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          offer_price: decision.counterPrice,
          message: `🤖 AI Agent: ${decision.reasoning}`,
          status: 'pending',
          ai_generated: true
        });

      // Update booking
      await supabase
        .from('bookings')
        .update({
          status: 'negotiating',
          final_price: decision.counterPrice
        })
        .eq('id', bookingId);

      // Notify the other party
      await notificationService.notifyNegotiationOffer(
        toUserId,
        bookingId,
        'AI Agent',
        decision.counterPrice,
        decision.reasoning
      );

      // If other party also has AI, trigger their response
      const otherPartyHasAI = fromUserId === ownerId 
        ? context.renterPreferences?.enabled
        : context.ownerPreferences?.enabled;

      if (otherPartyHasAI) {
        debug.info('Other party has AI enabled, will respond automatically');
        // Trigger next round of negotiation after a delay
        setTimeout(() => {
          this.triggerNextAIResponse(bookingId);
        }, 3000); // 3 second delay for realism
      }

    } else if (decision.action === 'reject') {
      // Update negotiation to rejected
      await supabase
        .from('negotiations')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString()
        })
        .eq('id', latestNegotiation.id);

      // Update booking
      await supabase
        .from('bookings')
        .update({
          status: 'rejected'
        })
        .eq('id', bookingId);

      // Notify rejection
      const toUserId = latestNegotiation.from_user_id;
      await notificationService.sendNotification({
        userId: toUserId,
        type: 'negotiation_offer',
        title: 'Offer Rejected by AI Agent',
        message: decision.reasoning,
        data: { bookingId, aiGenerated: true }
      });
    }
  }

  /**
   * Trigger next AI response in chain
   */
  private async triggerNextAIResponse(bookingId: string): Promise<void> {
    try {
      // Fetch latest booking and negotiation data
      const { data: booking } = await supabase
        .from('bookings')
        .select('*, spaces(*)')
        .eq('id', bookingId)
        .single();

      if (!booking || booking.status !== 'negotiating') {
        return;
      }

      const { data: negotiations } = await supabase
        .from('negotiations')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      if (!negotiations || negotiations.length === 0) {
        return;
      }

      const latestNeg = negotiations[0];
      if (latestNeg.status !== 'pending') {
        return;
      }

      // Get AI preferences
      const ownerPrefs = await this.getAIPreferences(booking.owner_id, 'owner');
      const renterPrefs = await this.getAIPreferences(booking.renter_id, 'renter');

      const context: NegotiationContext = {
        spaceId: booking.space_id,
        ownerId: booking.owner_id,
        renterId: booking.renter_id,
        bookingId: booking.id,
        originalPrice: booking.original_price,
        currentOffer: latestNeg.offer_price,
        listingData: booking.spaces,
        negotiationHistory: negotiations,
        ownerPreferences: ownerPrefs,
        renterPreferences: renterPrefs
      };

      // Process with AI
      await this.processNegotiationWithAI(context);
    } catch (error) {
      debug.error('Failed to trigger next AI response', error);
    }
  }

  /**
   * Check if AI agent should handle negotiation
   */
  private shouldUseAIAgent(context: NegotiationContext): boolean {
    return (context.ownerPreferences?.enabled || context.renterPreferences?.enabled) || false;
  }

  /**
   * Get market data for pricing analysis
   */
  private async getMarketData(context: NegotiationContext): Promise<MarketData> {
    // In production, this would query real market data
    // For now, simulate based on listing data

    try {
      // Get similar spaces in the area
      const { data: similarSpaces } = await supabase
        .from('spaces')
        .select('price_per_hour, space_type')
        .eq('space_type', context.listingData?.space_type)
        .neq('id', context.spaceId)
        .limit(20);

      if (similarSpaces && similarSpaces.length > 0) {
        const prices = similarSpaces.map(s => s.price_per_hour);
        const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const sortedPrices = prices.sort((a, b) => a - b);
        const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

        return {
          averagePrice,
          medianPrice,
          priceRange: {
            min: Math.min(...prices),
            max: Math.max(...prices)
          },
          competitorCount: similarSpaces.length,
          demandLevel: similarSpaces.length > 15 ? 'high' : similarSpaces.length > 8 ? 'medium' : 'low',
          seasonalFactor: 1.0
        };
      }
    } catch (error) {
      debug.error('Failed to get market data', error);
    }

    // Fallback mock data
    return {
      averagePrice: context.originalPrice * 0.95,
      medianPrice: context.originalPrice,
      priceRange: {
        min: context.originalPrice * 0.7,
        max: context.originalPrice * 1.3
      },
      competitorCount: 10,
      demandLevel: 'medium',
      seasonalFactor: 1.0
    };
  }

  /**
   * Get AI preferences for a user
   */
  async getAIPreferences(userId: string, role: 'owner' | 'renter'): Promise<AIAgentPreferences> {
    // Check if user has stored preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // For now, return default preferences
    // In production, these would be stored in user settings
    return {
      enabled: false, // Default off, user must opt-in
      negotiationStrategy: 'moderate',
      autoAcceptThreshold: role === 'owner' ? 0.95 : 1.05,
      maxCounterOffers: 5
    };
  }

  /**
   * Enable AI agent for a user
   */
  async enableAIAgent(
    userId: string,
    role: 'owner' | 'renter',
    preferences: Partial<AIAgentPreferences>
  ): Promise<void> {
    // Store preferences (in production, save to database)
    debug.info('AI agent enabled', { userId, role, preferences });
    
    // For now, just log it
    // In production, save to user_settings table or profile
  }
}

export const aiAgentNegotiationService = new AIAgentNegotiationService();
export type { AIAgentPreferences, NegotiationDecision, NegotiationContext };

