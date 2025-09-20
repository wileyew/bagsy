-- Add AI enhancement fields to spaces table
ALTER TABLE public.spaces 
ADD COLUMN smart_scheduling_enabled BOOLEAN DEFAULT false,
ADD COLUMN ai_marketing_enabled BOOLEAN DEFAULT false,
ADD COLUMN predictive_analytics_enabled BOOLEAN DEFAULT false,
ADD COLUMN ai_support_enabled BOOLEAN DEFAULT false,
ADD COLUMN space_types TEXT[] DEFAULT '{}';

-- Add comments to explain the new fields
COMMENT ON COLUMN public.spaces.smart_scheduling_enabled IS 'Whether AI should optimize availability and scheduling for this space';
COMMENT ON COLUMN public.spaces.ai_marketing_enabled IS 'Whether AI should generate marketing content for this space';
COMMENT ON COLUMN public.spaces.predictive_analytics_enabled IS 'Whether AI should provide predictive analytics for this space';
COMMENT ON COLUMN public.spaces.ai_support_enabled IS 'Whether AI should handle customer support for this space';
COMMENT ON COLUMN public.spaces.space_types IS 'Array of space types this space can accommodate';

-- Create user preferences table for AI matching
CREATE TABLE public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_type_preferences TEXT[] DEFAULT '{}',
  price_range_min DECIMAL(10,2),
  price_range_max DECIMAL(10,2),
  location_preferences TEXT[] DEFAULT '{}',
  amenities_preferences TEXT[] DEFAULT '{}',
  search_history JSONB DEFAULT '{}',
  booking_patterns JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_preferences
CREATE POLICY "Users can view their own preferences" 
ON public.user_preferences 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" 
ON public.user_preferences 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" 
ON public.user_preferences 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create AI analytics table for storing AI insights
CREATE TABLE public.ai_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  analytics_type TEXT NOT NULL CHECK (analytics_type IN ('demand_prediction', 'pricing_optimization', 'market_analysis', 'booking_patterns', 'user_behavior')),
  data JSONB NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on ai_analytics
ALTER TABLE public.ai_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for ai_analytics
CREATE POLICY "Space owners can view their analytics" 
ON public.ai_analytics 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = ai_analytics.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can view their own analytics" 
ON public.ai_analytics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert analytics" 
ON public.ai_analytics 
FOR INSERT 
WITH CHECK (true);

-- Create smart scheduling table for availability optimization
CREATE TABLE public.smart_scheduling (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  optimal_hours JSONB NOT NULL DEFAULT '{}',
  demand_patterns JSONB NOT NULL DEFAULT '{}',
  pricing_adjustments JSONB NOT NULL DEFAULT '{}',
  availability_windows JSONB NOT NULL DEFAULT '{}',
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on smart_scheduling
ALTER TABLE public.smart_scheduling ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for smart_scheduling
CREATE POLICY "Space owners can view their scheduling data" 
ON public.smart_scheduling 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = smart_scheduling.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

CREATE POLICY "System can manage scheduling data" 
ON public.smart_scheduling 
FOR ALL 
WITH CHECK (true);

-- Create marketing content table for AI-generated content
CREATE TABLE public.marketing_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('title', 'description', 'seo_title', 'social_media', 'email_campaign')),
  content TEXT NOT NULL,
  ai_generated BOOLEAN DEFAULT true,
  performance_metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on marketing_content
ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for marketing_content
CREATE POLICY "Space owners can view their marketing content" 
ON public.marketing_content 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = marketing_content.space_id 
    AND spaces.owner_id = auth.uid()
  )
);

CREATE POLICY "System can manage marketing content" 
ON public.marketing_content 
FOR ALL 
WITH CHECK (true);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX idx_ai_analytics_space_id ON public.ai_analytics(space_id);
CREATE INDEX idx_ai_analytics_type ON public.ai_analytics(analytics_type);
CREATE INDEX idx_smart_scheduling_space_id ON public.smart_scheduling(space_id);
CREATE INDEX idx_marketing_content_space_id ON public.marketing_content(space_id);
CREATE INDEX idx_marketing_content_type ON public.marketing_content(content_type);
