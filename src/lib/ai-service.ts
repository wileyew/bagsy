export interface LocationContext {
  address?: string;
  zipCode?: string;
  selectedSpaceTypes?: string[];
  enableWebScraping?: boolean;
  enablePricingOptimization?: boolean;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    accuracy: number;
  };
}

interface PhotoAnalysisResult {
  spaceType: string;
  title: string;
  description: string;
  dimensions: string;
  pricePerHour: number;
  features: string[];
}

class AIService {
  private baseUrl = 'https://api.openai.com/v1';
  private apiKey: string;
  
  // Alternative API configurations (commented out for future use)
  // private geminiApiKey: string;
  // private claudeApiKey: string;
  // private provider: 'openai' | 'gemini' | 'claude' = 'openai';

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    // this.geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    // this.claudeApiKey = import.meta.env.VITE_CLAUDE_API_KEY || '';
    console.log('AI Service initialized. API Key present:', !!this.apiKey);
    console.log('API Key length:', this.apiKey.length);
  }

  async analyzeSpacePhotos(
    photoUrls: string[], 
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    console.log('🤖 Starting AI analysis...');
    console.log('📊 Analysis Parameters:', {
      apiKeyPresent: !!this.apiKey,
      apiKeyLength: this.apiKey.length,
      photoCount: photoUrls.length,
      location: location.address ? `${location.address}, ${location.zipCode}` : 'Not specified',
      geolocation: location.currentLocation ? `${location.currentLocation.latitude}, ${location.currentLocation.longitude}` : 'Not available',
      selectedSpaceTypes: location.selectedSpaceTypes || [],
      webScrapingEnabled: location.enableWebScraping || false,
      pricingOptimizationEnabled: location.enablePricingOptimization || false
    });
    console.log('📸 Photo URLs:', photoUrls);
    
    // If API key is available, use real analysis
    if (this.apiKey) {
      console.log('✅ API key found - proceeding with real OpenAI analysis');
      return await this.realAnalysis(photoUrls, location);
    } else {
      console.error('❌ No OpenAI API key found!');
      console.error('🔧 To enable AI analysis, set VITE_OPENAI_API_KEY in your environment variables');
      throw new Error('AI analysis unavailable - OpenAI API key not configured. Please enter your space details manually.');
    }
  }

  private async realAnalysis(
    photoUrls: string[],
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    const startTime = Date.now();
    console.log('🚀 Making real API call to OpenAI...');
    console.log('🌐 API URL:', `${this.baseUrl}/chat/completions`);
    
    const requestBody = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze these photos of a space for rent and generate a comprehensive listing.

              CONTEXT:
              ${location.address && location.zipCode ? `Location: ${location.address}, ${location.zipCode}` : 'Location: Not specified'}
              ${location.currentLocation ? `Precise Location: ${location.currentLocation.latitude}, ${location.currentLocation.longitude} (${location.currentLocation.address})` : 'Precise Location: Not available'}
              ${location.selectedSpaceTypes && location.selectedSpaceTypes.length > 0 ? `Selected Space Types: ${location.selectedSpaceTypes.join(', ')}` : 'No specific space types selected'}
              ${location.enableWebScraping ? 'Market Research: Enabled - consider competitive pricing and market positioning' : 'Market Research: Disabled'}
              ${location.enablePricingOptimization ? 'Pricing Optimization: Enabled - suggest optimal pricing strategy' : 'Pricing Optimization: Disabled'}

              ANALYSIS REQUIREMENTS:
              ${location.enableWebScraping ? `
              - Focus on space type identification and market positioning
              - Provide detailed description highlighting competitive advantages
              - Include specific dimensions and features that differentiate this space
              - Suggest pricing that can be enhanced with market data
              - Emphasize unique selling points for market competition
              ` : `
              - Identify the primary space type from the photos
              - Provide a compelling description based on visual features
              - Estimate dimensions based on what's visible
              - Suggest competitive pricing for the area
              `}
              
              1. Space type: Choose the MOST APPROPRIATE type from: garage, driveway, warehouse, parking_spot, storage_unit, outdoor_space, rv_storage, other
              2. Title: Create a compelling, SEO-friendly title (max 60 characters) that highlights key benefits
              3. Description: Write a detailed, marketing-focused description (2-3 sentences) that emphasizes unique features and benefits
              4. Dimensions: Estimate realistic dimensions based on what you can see in the photos
              5. Pricing: Suggest competitive hourly price based on:
                 - Space type and quality
                 - Location (if provided)
                 - Market conditions
                 - Space features and amenities
              6. Features: List 3-5 key selling points and amenities

              PRICING GUIDELINES:
              - Garage: $5-15/hour (urban areas higher)
              - Driveway: $3-8/hour
              - Warehouse: $20-50/hour
              - Parking Spot: $2-6/hour
              - Storage Unit: $8-25/hour
              - Outdoor Space: $4-12/hour
              - RV Storage: $10-30/hour

              IMPORTANT: Return ONLY valid JSON in this exact format:
              {
                "spaceType": "garage",
                "title": "Modern Garage Space",
                "description": "Clean, secure garage space perfect for storage or parking",
                "dimensions": "20x10 feet",
                "pricePerHour": 8,
                "features": ["Secure access", "Well-lit", "Easy parking"]
              }
              
              Do not include any text before or after the JSON. Return only the JSON object.`
            },
            ...photoUrls.map(url => ({
              type: 'image_url',
              image_url: { url }
            }))
          ]
        }
      ],
      max_tokens: 500,
    };

    console.log('📤 Request payload:', {
      model: requestBody.model,
      messageCount: requestBody.messages.length,
      photoCount: photoUrls.length,
      maxTokens: requestBody.max_tokens,
      promptLength: requestBody.messages[0].content[0].text.length
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseTime = Date.now() - startTime;
      console.log('⏱️ API Response time:', `${responseTime}ms`);
      console.log('📊 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error:', {
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText
        });
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📥 OpenAI Response:', {
        model: data.model,
        usage: data.usage,
        finishReason: data.choices[0]?.finish_reason,
        contentLength: data.choices[0]?.message?.content?.length || 0
      });

      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        console.error('❌ No content in OpenAI response:', data);
        throw new Error('No analysis result from OpenAI');
      }

      console.log('📝 Raw AI Response:', content);

      try {
        // Try to extract JSON from the response content
        const cleanedContent = this.extractJSONFromContent(content);
        const analysis = JSON.parse(cleanedContent);
        console.log('✅ Parsed AI Analysis:', analysis);
        
        const result = {
          spaceType: analysis.spaceType || 'garage',
          title: analysis.title || 'Space Available',
          description: analysis.description || 'A great space for your needs',
          dimensions: analysis.dimensions || 'Standard size',
          pricePerHour: analysis.pricePerHour || 5,
          features: analysis.features || ['Convenient location']
        };
        
        console.log('🎯 Final Analysis Result:', result);
        return result;
      } catch (parseError) {
        console.error('❌ Failed to parse AI response as JSON:', {
          content,
          parseError: parseError instanceof Error ? parseError.message : String(parseError)
        });
        
        // Fallback: try to extract information using regex patterns
        console.log('🔄 Attempting fallback parsing...');
        const fallbackResult = this.parseWithFallback(content);
        console.log('🎯 Fallback Analysis Result:', fallbackResult);
        return fallbackResult;
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error('💥 OpenAI API call failed:', {
        error: error instanceof Error ? error.message : String(error),
        responseTime: `${responseTime}ms`,
        photoCount: photoUrls.length
      });
      throw error;
    }
  }

  private async mockAnalysis(
    photoUrls: string[],
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    console.log('Using MOCK analysis - simulating API delay...');
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock AI analysis based on address patterns (if location provided)
    const hasLocation = location.address && location.zipCode;
    const isUrban = hasLocation && (
      location.address.toLowerCase().includes('san francisco') || 
      location.address.toLowerCase().includes('sf') ||
      location.address.toLowerCase().includes('mission') ||
      location.address.toLowerCase().includes('valencia') ||
      location.address.toLowerCase().includes('downtown')
    );
    
    const basePrice = isUrban ? 8 : 6; // Default to middle price if no location
    const spaceType = isUrban ? 'garage' : 'storage_unit';
    
    return {
      spaceType,
      title: hasLocation 
        ? `${isUrban ? 'Spacious' : 'Convenient'} ${isUrban ? 'Garage' : 'Storage Unit'} in ${location.address.split(',')[0]}`
        : 'Versatile Storage Space Available',
      description: hasLocation
        ? `Perfect ${isUrban ? 'covered storage space' : 'storage unit'} in a ${isUrban ? 'prime urban location' : 'convenient location'}. ${isUrban ? 'Secure and easily accessible' : 'Easy access and well-maintained'}. Ideal for ${isUrban ? 'short-term storage or vehicle parking' : 'storage needs'}.`
        : 'Flexible storage space perfect for your needs. Secure and easily accessible with convenient loading access. Ideal for short-term or long-term storage solutions.',
      dimensions: isUrban ? '20x12 feet' : '15x10 feet',
      pricePerHour: basePrice,
      features: isUrban 
        ? ['Secure access', 'Well-lit', 'Near public transit', 'Easy loading']
        : ['Easy access', 'Well-maintained', 'Secure', 'Ample space']
    };
  }

  // ============================================================================
  // ALTERNATIVE PROVIDER IMPLEMENTATIONS (COMMENTED OUT FOR FUTURE USE)
  // ============================================================================

  /*
  // Google Gemini 1.5 Pro Vision Implementation
  private async geminiAnalysis(
    photoUrls: string[],
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    console.log('Using Gemini 1.5 Pro Vision for analysis...');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${this.geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analyze these photos of a space for rent and generate a listing.
              ${location.address && location.zipCode ? `Location: ${location.address}, ${location.zipCode}` : 'Location: Not specified'}

              Please provide:
              1. Space type (garage, driveway, warehouse, parking_spot, storage_unit, outdoor_space)
              2. Compelling title (max 60 characters)
              3. Detailed description (2-3 sentences)
              4. Estimated dimensions
              5. Suggested hourly price (use average market rates if location not specified)
              6. Key features

              Return as JSON with these fields: spaceType, title, description, dimensions, pricePerHour, features`
            },
            ...photoUrls.map(url => ({
              inline_data: {
                mime_type: "image/jpeg",
                data: url.split(',')[1] // Base64 data
              }
            }))
          ]
        }]
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.candidates[0]?.content?.parts[0]?.text;
    
    if (!content) {
      throw new Error('No analysis result from Gemini');
    }

    try {
      const analysis = JSON.parse(content);
      return {
        spaceType: analysis.spaceType || 'garage',
        title: analysis.title || 'Space Available',
        description: analysis.description || 'A great space for your needs',
        dimensions: analysis.dimensions || 'Standard size',
        pricePerHour: analysis.pricePerHour || 5,
        features: analysis.features || ['Convenient location']
      };
    } catch (parseError) {
      throw new Error('Failed to parse Gemini analysis result');
    }
  }

  // Anthropic Claude 3.5 Sonnet Implementation
  private async claudeAnalysis(
    photoUrls: string[],
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    console.log('Using Claude 3.5 Sonnet for analysis...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.claudeApiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze these photos of a space for rent and generate a listing.
              ${location.address && location.zipCode ? `Location: ${location.address}, ${location.zipCode}` : 'Location: Not specified'}

              Please provide:
              1. Space type (garage, driveway, warehouse, parking_spot, storage_unit, outdoor_space)
              2. Compelling title (max 60 characters)
              3. Detailed description (2-3 sentences)
              4. Estimated dimensions
              5. Suggested hourly price (use average market rates if location not specified)
              6. Key features

              Return as JSON with these fields: spaceType, title, description, dimensions, pricePerHour, features`
            },
            ...photoUrls.map(url => ({
              type: 'image',
              source: {
                type: 'url',
                url: url
              }
            }))
          ]
        }]
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text;
    
    if (!content) {
      throw new Error('No analysis result from Claude');
    }

    try {
      const analysis = JSON.parse(content);
      return {
        spaceType: analysis.spaceType || 'garage',
        title: analysis.title || 'Space Available',
        description: analysis.description || 'A great space for your needs',
        dimensions: analysis.dimensions || 'Standard size',
        pricePerHour: analysis.pricePerHour || 5,
        features: analysis.features || ['Convenient location']
      };
    } catch (parseError) {
      throw new Error('Failed to parse Claude analysis result');
    }
  }

  // Provider switching method (commented out)
  private async analyzeWithProvider(
    photoUrls: string[],
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    switch(this.provider) {
      case 'gemini':
        return await this.geminiAnalysis(photoUrls, location);
      case 'claude':
        return await this.claudeAnalysis(photoUrls, location);
      case 'openai':
      default:
        return await this.realAnalysis(photoUrls, location);
    }
  }
  */

  async optimizePricing(
    basePrice: number,
    spaceType: string,
    location?: string,
    marketData?: any
  ): Promise<{
    optimizedPrice: number;
    reasoning: string;
    recommendations: string[];
    marketFactors: any;
  }> {
    console.log('💰 Starting AI pricing optimization...');
    console.log('📊 Optimization Parameters:', {
      basePrice,
      spaceType,
      location: location || 'Not specified',
      hasMarketData: !!marketData
    });

    if (!this.apiKey) {
      console.warn('⚠️ No OpenAI API key - using fallback pricing optimization');
      return this.getFallbackPricingOptimization(basePrice, spaceType, location);
    }

    const startTime = Date.now();
    console.log('🚀 Making OpenAI API call for pricing optimization...');

    const prompt = `You are a pricing optimization expert for space rental platforms. Analyze the following data and provide optimal pricing recommendations.

    SPACE DETAILS:
    - Space Type: ${spaceType}
    - Current Base Price: $${basePrice}/hour
    - Location: ${location || 'Not specified'}
    ${marketData ? `- Market Data Available: Yes (${marketData.competitorCount} competitors found)` : '- Market Data Available: No'}

    ${marketData ? `
    MARKET DATA:
    - Average Market Price: $${marketData.averagePrice}/hour
    - Price Range: $${marketData.priceRange.min} - $${marketData.priceRange.max}/hour
    - Competitor Count: ${marketData.competitorCount}
    ` : ''}

    OPTIMIZATION REQUIREMENTS:
    1. Suggest an optimized hourly price based on market conditions
    2. Provide clear reasoning for the pricing decision
    3. List 3-4 specific pricing recommendations (peak hours, weekends, seasonal, etc.)
    4. Analyze market factors that influence pricing

      IMPORTANT: Return ONLY valid JSON in this exact format:
      {
        "optimizedPrice": 12.5,
        "reasoning": "Based on market analysis and location factors",
        "recommendations": ["Peak hour pricing", "Weekend premium"],
        "marketFactors": {"demandLevel": "High", "competitionLevel": "Medium"}
      }
      
      Do not include any text before or after the JSON. Return only the JSON object.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
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

      const responseTime = Date.now() - startTime;
      console.log('⏱️ Pricing optimization response time:', `${responseTime}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Pricing optimization API error:', errorText);
        throw new Error(`Pricing optimization failed: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No pricing optimization result from OpenAI');
      }

      console.log('📝 Raw pricing optimization response:', content);

      const optimization = JSON.parse(content);
      console.log('✅ Parsed pricing optimization:', optimization);

      return {
        optimizedPrice: optimization.optimizedPrice || basePrice * 1.1,
        reasoning: optimization.reasoning || 'AI-optimized pricing based on market analysis',
        recommendations: optimization.recommendations || ['Consider peak hour pricing'],
        marketFactors: optimization.marketFactors || { demandLevel: 'Medium' }
      };
    } catch (error) {
      console.error('💥 Pricing optimization failed:', error);
      return this.getFallbackPricingOptimization(basePrice, spaceType, location);
    }
  }

  private getFallbackPricingOptimization(
    basePrice: number,
    spaceType: string,
    location?: string
  ) {
    console.log('🔄 Using fallback pricing optimization');
    
    const isUrban = location && (
      location.toLowerCase().includes('san francisco') ||
      location.toLowerCase().includes('new york') ||
      location.toLowerCase().includes('los angeles')
    );

    const optimizationFactor = isUrban ? 1.2 : 1.1;
    const optimizedPrice = Math.round(basePrice * optimizationFactor * 100) / 100;

    return {
      optimizedPrice,
      reasoning: `Optimized pricing based on ${isUrban ? 'urban market conditions' : 'standard market rates'}. ${isUrban ? 'Urban areas typically command 20% higher rates' : 'Standard market adjustment applied'}.`,
      recommendations: [
        'Consider peak hour pricing (+20% during 9-5 weekdays)',
        'Weekend premium pricing (+25% for Saturday-Sunday)',
        'Seasonal adjustments (+10% during summer months)',
        'Dynamic pricing based on booking frequency'
      ],
      marketFactors: {
        demandLevel: isUrban ? 'High' : 'Medium',
        competitionLevel: 'Medium',
        seasonalTrend: 'Stable',
        locationPremium: isUrban ? 'Premium location detected' : 'Standard location'
      }
    };
  }

  private extractJSONFromContent(content: string): string {
    console.log('🔍 Extracting JSON from content...');
    
    // Try to find JSON object in the content
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('✅ Found JSON object in content');
      return jsonMatch[0];
    }
    
    // Try to find JSON array
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      console.log('✅ Found JSON array in content');
      return arrayMatch[0];
    }
    
    // If no JSON found, return the original content
    console.log('⚠️ No JSON structure found, returning original content');
    return content;
  }

  private parseWithFallback(content: string): PhotoAnalysisResult {
    console.log('🔍 Parsing content with fallback method...');
    
    // Extract information using regex patterns
    const spaceTypeMatch = content.match(/"spaceType":\s*"([^"]+)"/i) || 
                          content.match(/spaceType:\s*([^,\n]+)/i);
    const titleMatch = content.match(/"title":\s*"([^"]+)"/i) || 
                       content.match(/title:\s*([^,\n]+)/i);
    const descriptionMatch = content.match(/"description":\s*"([^"]+)"/i) || 
                           content.match(/description:\s*([^,\n]+)/i);
    const dimensionsMatch = content.match(/"dimensions":\s*"([^"]+)"/i) || 
                           content.match(/dimensions:\s*([^,\n]+)/i);
    const priceMatch = content.match(/"pricePerHour":\s*(\d+(?:\.\d+)?)/i) || 
                      content.match(/pricePerHour:\s*(\d+(?:\.\d+)?)/i) ||
                      content.match(/\$(\d+(?:\.\d+)?)/);
    
    const result: PhotoAnalysisResult = {
      spaceType: spaceTypeMatch ? spaceTypeMatch[1].trim() : 'garage',
      title: titleMatch ? titleMatch[1].trim() : 'Space Available',
      description: descriptionMatch ? descriptionMatch[1].trim() : 'A great space for your needs',
      dimensions: dimensionsMatch ? dimensionsMatch[1].trim() : 'Standard size',
      pricePerHour: priceMatch ? parseFloat(priceMatch[1]) : 5,
      features: ['Convenient location', 'Easy access']
    };
    
    console.log('📊 Extracted values:', {
      spaceType: result.spaceType,
      title: result.title,
      description: result.description.substring(0, 50) + '...',
      dimensions: result.dimensions,
      pricePerHour: result.pricePerHour
    });
    
    return result;
  }
}

export const aiService = new AIService();
