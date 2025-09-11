interface LocationContext {
  address?: string;
  zipCode?: string;
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

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
    console.log('AI Service initialized. API Key present:', !!this.apiKey);
    console.log('API Key length:', this.apiKey.length);
  }

  async analyzeSpacePhotos(
    photoUrls: string[], 
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    console.log('Starting AI analysis. API Key present:', !!this.apiKey);
    console.log('Photo URLs:', photoUrls);
    console.log('Location:', location);
    
    // If API key is available, use real analysis
    if (this.apiKey) {
      console.log('Using real AI analysis');
      return await this.realAnalysis(photoUrls, location);
    } else {
      console.log('No API key available - throwing error for manual entry');
      throw new Error('AI analysis unavailable - please enter your space details manually');
    }
  }

  private async realAnalysis(
    photoUrls: string[],
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    console.log('Making real API call to OpenAI...');
    console.log('API URL:', `${this.baseUrl}/chat/completions`);
    
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
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
                type: 'image_url',
                image_url: { url }
              }))
            ]
          }
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No analysis result from OpenAI');
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
      throw new Error('Failed to parse AI analysis result');
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
}

export const aiService = new AIService();
