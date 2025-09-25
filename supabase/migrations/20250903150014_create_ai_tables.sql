-- Create AI-related tables for enhanced functionality
-- This migration runs after the spaces table is created

-- Create user preferences table for AI matching
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_type_preferences TEXT DEFAULT '[]',
  price_range_min DECIMAL(10,2),
  price_range_max DECIMAL(10,2),
  location_preferences TEXT DEFAULT '[]',
  amenities_preferences TEXT DEFAULT '[]',
  search_history TEXT DEFAULT '{}',
  booking_patterns TEXT DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_preferences
CREATE POLICY "Users can view their own preferences" 
ON user_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
ON user_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
ON user_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" 
ON user_preferences 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create AI analytics table for storing AI insights
CREATE TABLE ai_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics_type TEXT NOT NULL CHECK (analytics_type IN ('demand_prediction', 'pricing_optimization', 'market_analysis', 'booking_patterns', 'user_behavior')),
  data TEXT NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on ai_analytics
ALTER TABLE ai_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_analytics
CREATE POLICY "Users can view analytics for their spaces" 
ON ai_analytics 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = ai_analytics.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

-- Create smart scheduling table for availability optimization
CREATE TABLE smart_scheduling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  optimal_hours TEXT NOT NULL DEFAULT '{}',
  demand_patterns TEXT NOT NULL DEFAULT '{}',
  pricing_adjustments TEXT NOT NULL DEFAULT '{}',
  availability_windows TEXT NOT NULL DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on smart_scheduling
ALTER TABLE smart_scheduling ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for smart_scheduling
CREATE POLICY "Users can view smart scheduling for their spaces" 
ON smart_scheduling 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = smart_scheduling.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can manage smart scheduling for their spaces" 
ON smart_scheduling 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = smart_scheduling.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

-- Create marketing content table for AI-generated content
CREATE TABLE marketing_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('title', 'description', 'seo_title', 'social_media', 'email_campaign')),
  content TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT true,
  performance_metrics TEXT DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on marketing_content
ALTER TABLE marketing_content ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for marketing_content
CREATE POLICY "Users can view marketing content for their spaces" 
ON marketing_content 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = marketing_content.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can manage marketing content for their spaces" 
ON marketing_content 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = marketing_content.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

-- Create triggers for automatic timestamp updates (PostgreSQL syntax)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_ai_analytics_space_id ON ai_analytics(space_id);
CREATE INDEX idx_ai_analytics_type ON ai_analytics(analytics_type);
CREATE INDEX idx_smart_scheduling_space_id ON smart_scheduling(space_id);
CREATE INDEX idx_marketing_content_space_id ON marketing_content(space_id);
CREATE INDEX idx_marketing_content_type ON marketing_content(content_type);
