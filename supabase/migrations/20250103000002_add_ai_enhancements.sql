-- Add AI enhancement fields to spaces table
ALTER TABLE spaces ADD smart_scheduling_enabled BIT DEFAULT 0;
ALTER TABLE spaces ADD ai_marketing_enabled BIT DEFAULT 0;
ALTER TABLE spaces ADD predictive_analytics_enabled BIT DEFAULT 0;
ALTER TABLE spaces ADD ai_support_enabled BIT DEFAULT 0;
ALTER TABLE spaces ADD space_types NVARCHAR(MAX) DEFAULT '[]';

-- Add comments to explain the new fields (SQL Server syntax)
EXEC sp_addextendedproperty 'MS_Description', 'Whether AI should optimize availability and scheduling for this space', 'SCHEMA', 'dbo', 'TABLE', 'spaces', 'COLUMN', 'smart_scheduling_enabled';
EXEC sp_addextendedproperty 'MS_Description', 'Whether AI should generate marketing content for this space', 'SCHEMA', 'dbo', 'TABLE', 'spaces', 'COLUMN', 'ai_marketing_enabled';
EXEC sp_addextendedproperty 'MS_Description', 'Whether AI should provide predictive analytics for this space', 'SCHEMA', 'dbo', 'TABLE', 'spaces', 'COLUMN', 'predictive_analytics_enabled';
EXEC sp_addextendedproperty 'MS_Description', 'Whether AI should handle customer support for this space', 'SCHEMA', 'dbo', 'TABLE', 'spaces', 'COLUMN', 'ai_support_enabled';
EXEC sp_addextendedproperty 'MS_Description', 'Array of space types this space can accommodate', 'SCHEMA', 'dbo', 'TABLE', 'spaces', 'COLUMN', 'space_types';

-- Create user preferences table for AI matching
CREATE TABLE user_preferences (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL,
  space_type_preferences NVARCHAR(MAX) DEFAULT '[]',
  price_range_min DECIMAL(10,2),
  price_range_max DECIMAL(10,2),
  location_preferences NVARCHAR(MAX) DEFAULT '[]',
  amenities_preferences NVARCHAR(MAX) DEFAULT '[]',
  search_history NVARCHAR(MAX) DEFAULT '{}',
  booking_patterns NVARCHAR(MAX) DEFAULT '{}',
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE()
);

-- Note: RLS policies not supported in SQL Server
-- Use application-level security or views/functions for row-level security

-- Create AI analytics table for storing AI insights
CREATE TABLE ai_analytics (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  space_id UNIQUEIDENTIFIER,
  user_id UNIQUEIDENTIFIER,
  analytics_type NVARCHAR(50) NOT NULL CHECK (analytics_type IN ('demand_prediction', 'pricing_optimization', 'market_analysis', 'booking_patterns', 'user_behavior')),
  data NVARCHAR(MAX) NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0.0,
  created_at DATETIME2 DEFAULT GETDATE()
);

-- Note: RLS not supported in SQL Server


-- Create smart scheduling table for availability optimization
CREATE TABLE smart_scheduling (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  space_id UNIQUEIDENTIFIER NOT NULL,
  optimal_hours NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  demand_patterns NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  pricing_adjustments NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  availability_windows NVARCHAR(MAX) NOT NULL DEFAULT '{}',
  last_updated DATETIME2 DEFAULT GETDATE(),
  created_at DATETIME2 DEFAULT GETDATE()
);

-- Note: RLS policies not supported in SQL Server

-- Create marketing content table for AI-generated content
CREATE TABLE marketing_content (
  id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  space_id UNIQUEIDENTIFIER NOT NULL,
  content_type NVARCHAR(50) NOT NULL CHECK (content_type IN ('title', 'description', 'seo_title', 'social_media', 'email_campaign')),
  content NVARCHAR(MAX) NOT NULL,
  ai_generated BIT DEFAULT 1,
  performance_metrics NVARCHAR(MAX) DEFAULT '{}',
  created_at DATETIME2 DEFAULT GETDATE()
);

-- Note: RLS policies not supported in SQL Server

-- Create triggers for automatic timestamp updates (SQL Server syntax)
GO
CREATE TRIGGER update_user_preferences_updated_at
ON user_preferences
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE user_preferences 
    SET updated_at = GETDATE()
    FROM user_preferences u
    INNER JOIN inserted i ON u.id = i.id;
END;
GO

-- Create indexes for better performance
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_ai_analytics_space_id ON ai_analytics(space_id);
CREATE INDEX idx_ai_analytics_type ON ai_analytics(analytics_type);
CREATE INDEX idx_smart_scheduling_space_id ON smart_scheduling(space_id);
CREATE INDEX idx_marketing_content_space_id ON marketing_content(space_id);
CREATE INDEX idx_marketing_content_type ON marketing_content(content_type);
