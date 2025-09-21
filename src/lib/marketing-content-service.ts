import { supabase } from "@/integrations/supabase/client";
import { createComponentDebugger } from "./debug-utils";
import { openaiRequestManager } from './openai-request-manager';

const debug = createComponentDebugger('MarketingContentService');

export interface SEOContent {
  title: string;
  metaDescription: string;
  keywords: string[];
  optimizedTitle: string;
  optimizedDescription: string;
  seoScore: number;
}

export interface SocialMediaContent {
  platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin';
  content: string;
  hashtags: string[];
  imageSuggestions: string[];
  engagementScore: number;
}

export interface EmailCampaign {
  subject: string;
  previewText: string;
  content: string;
  callToAction: string;
  targetAudience: string;
  expectedOpenRate: number;
}

export interface OptimizationSuggestions {
  titleImprovements: string[];
  descriptionImprovements: string[];
  keywordSuggestions: string[];
  imageSuggestions: string[];
  overallScore: number;
}

export interface MarketingContentData {
  spaceId: string;
  contentType: 'title' | 'description' | 'seo_title' | 'social_media' | 'email_campaign';
  content: string;
  performanceMetrics: Record<string, any>;
  aiGenerated: boolean;
}

class MarketingContentService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  }

  /**
   * Generate SEO-optimized titles and descriptions
   */
  async generateSEOContent(spaceData: any, marketData: any): Promise<SEOContent> {
    debug.info('Generating SEO content', { spaceId: spaceData.id });

    try {
      if (this.apiKey) {
        return await this.aiGenerateSEOContent(spaceData, marketData);
      } else {
        return this.fallbackSEOContent(spaceData, marketData);
      }
    } catch (error) {
      debug.error('Failed to generate SEO content', error);
      return this.fallbackSEOContent(spaceData, marketData);
    }
  }

  /**
   * Create social media marketing content
   */
  async generateSocialMediaContent(spaceData: any): Promise<SocialMediaContent[]> {
    debug.info('Generating social media content', { spaceId: spaceData.id });

    try {
      const platforms: Array<'facebook' | 'instagram' | 'twitter' | 'linkedin'> = 
        ['facebook', 'instagram', 'twitter', 'linkedin'];

      const content: SocialMediaContent[] = [];

      for (const platform of platforms) {
        if (this.apiKey) {
          const platformContent = await this.aiGenerateSocialContent(spaceData, platform);
          content.push(platformContent);
        } else {
          const fallbackContent = this.fallbackSocialContent(spaceData, platform);
          content.push(fallbackContent);
        }
      }

      return content;
    } catch (error) {
      debug.error('Failed to generate social media content', error);
      return this.fallbackSocialMediaContent(spaceData);
    }
  }

  /**
   * Generate email marketing campaigns
   */
  async generateEmailCampaigns(spaceData: any, targetAudience: string): Promise<EmailCampaign[]> {
    debug.info('Generating email campaigns', { spaceId: spaceData.id, targetAudience });

    try {
      const campaigns: EmailCampaign[] = [];

      // Generate different types of email campaigns
      const campaignTypes = [
        { type: 'new_listing', audience: 'potential_renters' },
        { type: 'price_drop', audience: 'price_sensitive_users' },
        { type: 'availability_update', audience: 'interested_users' },
        { type: 'seasonal_promotion', audience: 'repeat_customers' }
      ];

      for (const campaignType of campaignTypes) {
        if (this.apiKey) {
          const campaign = await this.aiGenerateEmailCampaign(spaceData, campaignType.type, campaignType.audience);
          campaigns.push(campaign);
        } else {
          const fallbackCampaign = this.fallbackEmailCampaign(spaceData, campaignType.type, campaignType.audience);
          campaigns.push(fallbackCampaign);
        }
      }

      return campaigns;
    } catch (error) {
      debug.error('Failed to generate email campaigns', error);
      return this.fallbackEmailCampaigns(spaceData);
    }
  }

  /**
   * Create listing optimization suggestions
   */
  async optimizeListingContent(listingData: any): Promise<OptimizationSuggestions> {
    debug.info('Optimizing listing content', { spaceId: listingData.id });

    try {
      if (this.apiKey) {
        return await this.aiOptimizeListing(listingData);
      } else {
        return this.fallbackOptimization(listingData);
      }
    } catch (error) {
      debug.error('Failed to optimize listing content', error);
      return this.fallbackOptimization(listingData);
    }
  }

  /**
   * Store marketing content in database
   */
  async storeMarketingContent(spaceId: string, contentData: MarketingContentData): Promise<void> {
    debug.info('Storing marketing content', { spaceId, contentType: contentData.contentType });

    try {
      const { error } = await supabase
        .from('marketing_content')
        .insert({
          space_id: spaceId,
          content_type: contentData.contentType,
          content: contentData.content,
          ai_generated: contentData.aiGenerated,
          performance_metrics: contentData.performanceMetrics
        });

      if (error) {
        throw new Error(`Failed to store marketing content: ${error.message}`);
      }

      debug.info('Marketing content stored successfully');
    } catch (error) {
      debug.error('Failed to store marketing content', error);
      throw error;
    }
  }

  /**
   * Get marketing content for a space
   */
  async getMarketingContent(spaceId: string, contentType?: string): Promise<MarketingContentData[]> {
    debug.info('Retrieving marketing content', { spaceId, contentType });

    try {
      let query = supabase
        .from('marketing_content')
        .select('*')
        .eq('space_id', spaceId);

      if (contentType) {
        query = query.eq('content_type', contentType);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to retrieve marketing content: ${error.message}`);
      }

      return (data || []).map(item => ({
        spaceId: item.space_id,
        contentType: item.content_type,
        content: item.content,
        performanceMetrics: item.performance_metrics || {},
        aiGenerated: item.ai_generated
      }));
    } catch (error) {
      debug.error('Failed to retrieve marketing content', error);
      throw error;
    }
  }

  /**
   * Update performance metrics for marketing content
   */
  async updatePerformanceMetrics(contentId: string, metrics: Record<string, any>): Promise<void> {
    debug.info('Updating performance metrics', { contentId });

    try {
      const { error } = await supabase
        .from('marketing_content')
        .update({ performance_metrics: metrics })
        .eq('id', contentId);

      if (error) {
        throw new Error(`Failed to update performance metrics: ${error.message}`);
      }

      debug.info('Performance metrics updated successfully');
    } catch (error) {
      debug.error('Failed to update performance metrics', error);
      throw error;
    }
  }

  // Private AI generation methods

  private async aiGenerateSEOContent(spaceData: any, marketData: any): Promise<SEOContent> {
    // Check if requests are allowed using centralized manager
    const requestCheck = openaiRequestManager.canMakeRequest();
    if (!requestCheck.allowed) {
      debug.warn('OpenAI request blocked for SEO content:', requestCheck.reason);
      return this.fallbackSEOContent(spaceData);
    }

    // Reserve request slot using centralized manager
    const reserved = openaiRequestManager.reserveRequest();
    if (!reserved) {
      debug.warn('Failed to reserve OpenAI request slot for SEO content');
      return this.fallbackSEOContent(spaceData);
    }

    const prompt = `Generate SEO-optimized content for a space rental listing:

SPACE DETAILS:
- Type: ${spaceData.space_type}
- Title: ${spaceData.title}
- Description: ${spaceData.description}
- Location: ${spaceData.address}
- Price: $${spaceData.price_per_hour}/hour
- Dimensions: ${spaceData.dimensions}

MARKET DATA:
- Average Market Price: $${marketData?.averagePrice || 'N/A'}
- Competitor Count: ${marketData?.competitorCount || 'N/A'}
- Price Range: $${marketData?.priceRange?.min || 'N/A'} - $${marketData?.priceRange?.max || 'N/A'}

Generate:
1. SEO-optimized title (max 60 characters)
2. Meta description (max 160 characters)
3. 5-7 relevant keywords
4. Optimized listing title
5. Optimized listing description
6. SEO score (0-100)

Return as JSON with fields: title, metaDescription, keywords, optimizedTitle, optimizedDescription, seoScore`;

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
        throw new Error('No SEO content from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      debug.error('AI SEO content generation failed', error);
      throw error;
    }
  }

  private async aiGenerateSocialContent(spaceData: any, platform: string): Promise<SocialMediaContent> {
    // Check if requests are allowed using centralized manager
    const requestCheck = openaiRequestManager.canMakeRequest();
    if (!requestCheck.allowed) {
      debug.warn('OpenAI request blocked for social content:', requestCheck.reason);
      return this.fallbackSocialContent(spaceData, platform);
    }

    // Reserve request slot using centralized manager
    const reserved = openaiRequestManager.reserveRequest();
    if (!reserved) {
      debug.warn('Failed to reserve OpenAI request slot for social content');
      return this.fallbackSocialContent(spaceData, platform);
    }

    const platformPrompts = {
      facebook: 'Create a Facebook post for a space rental listing',
      instagram: 'Create an Instagram post with hashtags for a space rental listing',
      twitter: 'Create a Twitter post for a space rental listing',
      linkedin: 'Create a LinkedIn post for a professional space rental listing'
    };

    const prompt = `${platformPrompts[platform as keyof typeof platformPrompts]}:

SPACE DETAILS:
- Type: ${spaceData.space_type}
- Title: ${spaceData.title}
- Location: ${spaceData.address}
- Price: $${spaceData.price_per_hour}/hour
- Description: ${spaceData.description}

Generate:
1. Engaging content for ${platform}
2. Relevant hashtags (3-5)
3. Image suggestions (2-3)
4. Engagement score prediction (0-100)

Return as JSON with fields: content, hashtags, imageSuggestions, engagementScore`;

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
          max_tokens: 400,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No social content from OpenAI');
      }

      const result = JSON.parse(content);
      return {
        platform: platform as any,
        content: result.content,
        hashtags: result.hashtags,
        imageSuggestions: result.imageSuggestions,
        engagementScore: result.engagementScore
      };
    } catch (error) {
      debug.error('AI social content generation failed', error);
      throw error;
    }
  }

  private async aiGenerateEmailCampaign(spaceData: any, campaignType: string, audience: string): Promise<EmailCampaign> {
    // Check if requests are allowed using centralized manager
    const requestCheck = openaiRequestManager.canMakeRequest();
    if (!requestCheck.allowed) {
      debug.warn('OpenAI request blocked for email campaign:', requestCheck.reason);
      return this.fallbackEmailCampaign(spaceData, campaignType, audience);
    }

    // Reserve request slot using centralized manager
    const reserved = openaiRequestManager.reserveRequest();
    if (!reserved) {
      debug.warn('Failed to reserve OpenAI request slot for email campaign');
      return this.fallbackEmailCampaign(spaceData, campaignType, audience);
    }

    const prompt = `Create an email marketing campaign for a space rental listing:

SPACE DETAILS:
- Type: ${spaceData.space_type}
- Title: ${spaceData.title}
- Location: ${spaceData.address}
- Price: $${spaceData.price_per_hour}/hour
- Description: ${spaceData.description}

CAMPAIGN DETAILS:
- Type: ${campaignType}
- Target Audience: ${audience}

Generate:
1. Compelling subject line
2. Preview text (max 90 characters)
3. Email content (2-3 paragraphs)
4. Call-to-action
5. Expected open rate (0-100%)

Return as JSON with fields: subject, previewText, content, callToAction, targetAudience, expectedOpenRate`;

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
        throw new Error('No email campaign from OpenAI');
      }

      const result = JSON.parse(content);
      return {
        subject: result.subject,
        previewText: result.previewText,
        content: result.content,
        callToAction: result.callToAction,
        targetAudience: audience,
        expectedOpenRate: result.expectedOpenRate
      };
    } catch (error) {
      debug.error('AI email campaign generation failed', error);
      throw error;
    }
  }

  private async aiOptimizeListing(listingData: any): Promise<OptimizationSuggestions> {
    // Check if requests are allowed using centralized manager
    const requestCheck = openaiRequestManager.canMakeRequest();
    if (!requestCheck.allowed) {
      debug.warn('OpenAI request blocked for listing optimization:', requestCheck.reason);
      return this.fallbackListingOptimization(listingData);
    }

    // Reserve request slot using centralized manager
    const reserved = openaiRequestManager.reserveRequest();
    if (!reserved) {
      debug.warn('Failed to reserve OpenAI request slot for listing optimization');
      return this.fallbackListingOptimization(listingData);
    }

    const prompt = `Analyze and optimize this space rental listing:

CURRENT LISTING:
- Title: ${listingData.title}
- Description: ${listingData.description}
- Type: ${listingData.space_type}
- Price: $${listingData.price_per_hour}/hour
- Location: ${listingData.address}

Provide optimization suggestions:
1. Title improvements (2-3 suggestions)
2. Description improvements (2-3 suggestions)
3. Keyword suggestions (5-7 keywords)
4. Image suggestions (3-4 suggestions)
5. Overall optimization score (0-100)

Return as JSON with fields: titleImprovements, descriptionImprovements, keywordSuggestions, imageSuggestions, overallScore`;

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
        throw new Error('No optimization suggestions from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      debug.error('AI listing optimization failed', error);
      throw error;
    }
  }

  // Fallback methods

  private fallbackSEOContent(spaceData: any, marketData: any): SEOContent {
    return {
      title: `${spaceData.space_type} Rental in ${spaceData.address.split(',')[0]} - $${spaceData.price_per_hour}/hour`,
      metaDescription: `Rent a ${spaceData.space_type} in ${spaceData.address}. ${spaceData.description.substring(0, 120)}...`,
      keywords: [spaceData.space_type, 'rental', 'space', 'parking', 'storage', spaceData.address.split(',')[0].toLowerCase()],
      optimizedTitle: `${spaceData.title} - ${spaceData.space_type} Rental`,
      optimizedDescription: `${spaceData.description} Located at ${spaceData.address}. Perfect for ${spaceData.space_type} needs.`,
      seoScore: 75
    };
  }

  private fallbackSocialContent(spaceData: any, platform: string): SocialMediaContent {
    const content = `🏠 ${spaceData.title}\n📍 ${spaceData.address}\n💰 $${spaceData.price_per_hour}/hour\n\n${spaceData.description}`;
    
    return {
      platform: platform as any,
      content,
      hashtags: [`#${spaceData.space_type}`, '#rental', '#space', '#parking'],
      imageSuggestions: ['Exterior view', 'Interior space', 'Street view'],
      engagementScore: 65
    };
  }

  private fallbackSocialMediaContent(spaceData: any): SocialMediaContent[] {
    const platforms: Array<'facebook' | 'instagram' | 'twitter' | 'linkedin'> = 
      ['facebook', 'instagram', 'twitter', 'linkedin'];
    
    return platforms.map(platform => this.fallbackSocialContent(spaceData, platform));
  }

  private fallbackEmailCampaign(spaceData: any, campaignType: string, audience: string): EmailCampaign {
    const templates = {
      new_listing: {
        subject: `New ${spaceData.space_type} Available in ${spaceData.address.split(',')[0]}`,
        content: `We're excited to announce a new ${spaceData.space_type} rental opportunity! Located at ${spaceData.address}, this space offers ${spaceData.description.toLowerCase()}.`
      },
      price_drop: {
        subject: `Special Price on ${spaceData.space_type} in ${spaceData.address.split(',')[0]}`,
        content: `Great news! We've reduced the price for this ${spaceData.space_type} to $${spaceData.price_per_hour}/hour. Don't miss this opportunity!`
      },
      availability_update: {
        subject: `${spaceData.space_type} Now Available - ${spaceData.address.split(',')[0]}`,
        content: `The ${spaceData.space_type} at ${spaceData.address} is now available for booking. Reserve your spot today!`
      },
      seasonal_promotion: {
        subject: `Seasonal Special: ${spaceData.space_type} Rental`,
        content: `Take advantage of our seasonal promotion for this ${spaceData.space_type} at ${spaceData.address}. Perfect timing for your needs!`
      }
    };

    const template = templates[campaignType as keyof typeof templates] || templates.new_listing;

    return {
      subject: template.subject,
      previewText: `Rent this ${spaceData.space_type} for $${spaceData.price_per_hour}/hour`,
      content: template.content,
      callToAction: 'Book Now',
      targetAudience: audience,
      expectedOpenRate: 25
    };
  }

  private fallbackEmailCampaigns(spaceData: any): EmailCampaign[] {
    const campaignTypes = [
      { type: 'new_listing', audience: 'potential_renters' },
      { type: 'price_drop', audience: 'price_sensitive_users' },
      { type: 'availability_update', audience: 'interested_users' },
      { type: 'seasonal_promotion', audience: 'repeat_customers' }
    ];

    return campaignTypes.map(campaign => 
      this.fallbackEmailCampaign(spaceData, campaign.type, campaign.audience)
    );
  }

  private fallbackOptimization(listingData: any): OptimizationSuggestions {
    return {
      titleImprovements: [
        `Add location to title: "${listingData.title} - ${listingData.address.split(',')[0]}"`,
        `Include price: "${listingData.title} - $${listingData.price_per_hour}/hour"`,
        `Highlight key features: "${listingData.title} - Secure & Convenient"`
      ],
      descriptionImprovements: [
        'Add more specific details about amenities',
        'Include nearby landmarks or transportation',
        'Mention security features or access hours'
      ],
      keywordSuggestions: [
        listingData.space_type,
        'rental',
        'space',
        'parking',
        'storage',
        listingData.address.split(',')[0].toLowerCase(),
        'secure'
      ],
      imageSuggestions: [
        'Exterior view of the space',
        'Interior showing dimensions',
        'Street view for location context',
        'Access point or entrance'
      ],
      overallScore: 70
    };
  }
}

export const marketingContentService = new MarketingContentService();
