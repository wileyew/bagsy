interface LocationContext {
  address: string;
  zipCode: string;
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
  }

  async analyzeSpacePhotos(
    photoUrls: string[], 
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
    try {
      // If API key is available, use real analysis
      if (this.apiKey) {
        return await this.realAnalysis(photoUrls, location);
      } else {
        // Fallback to mock analysis
        return await this.mockAnalysis(photoUrls, location);
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
      // Fallback to mock analysis on error
      return await this.mockAnalysis(photoUrls, location);
    }
  }

  private async realAnalysis(
    photoUrls: string[],
    location: LocationContext
  ): Promise<PhotoAnalysisResult> {
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
                Location: ${location.address}, ${location.zipCode}

                Please provide:
                1. Space type (garage, driveway, warehouse, parking_spot, storage_unit, outdoor_space)
                2. Compelling title (max 60 characters)
                3. Detailed description (2-3 sentences)
                4. Estimated dimensions
                5. Suggested hourly price (considering location)
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
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock AI analysis based on address patterns
    const isUrban = location.address.toLowerCase().includes('san francisco') || 
                   location.address.toLowerCase().includes('sf') ||
                   location.address.toLowerCase().includes('mission') ||
                   location.address.toLowerCase().includes('valencia') ||
                   location.address.toLowerCase().includes('downtown');
    
    const basePrice = isUrban ? 8 : 5;
    const spaceType = isUrban ? 'garage' : 'driveway';
    
    return {
      spaceType,
      title: `${isUrban ? 'Spacious' : 'Convenient'} ${isUrban ? 'Garage' : 'Driveway'} in ${location.address.split(',')[0]}`,
      description: `Perfect ${isUrban ? 'covered storage space' : 'parking spot'} in a ${isUrban ? 'prime urban location' : 'quiet neighborhood'}. ${isUrban ? 'Secure and easily accessible' : 'Easy access and well-maintained'}. Ideal for ${isUrban ? 'short-term storage or vehicle parking' : 'daily parking or temporary storage'}.`,
      dimensions: isUrban ? '20x12 feet' : '10x20 feet',
      pricePerHour: basePrice,
      features: isUrban 
        ? ['Secure access', 'Well-lit', 'Near public transit', 'Easy loading']
        : ['Easy access', 'Well-maintained', 'Quiet area', 'Ample space']
    };
  }
}

export const aiService = new AIService();
