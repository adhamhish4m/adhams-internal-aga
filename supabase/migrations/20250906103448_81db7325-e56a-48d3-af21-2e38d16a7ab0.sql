-- ===================================
-- THIRTEEN AI ENHANCED DATABASE SCHEMA
-- Run this SQL in your Supabase SQL Editor
-- ===================================

-- 1. Create tokens table for authentication
CREATE TABLE IF NOT EXISTS tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_value VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER,
  active_status BOOLEAN DEFAULT true
);

-- 2. Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'processing',
  user_id VARCHAR(100) NOT NULL,
  source VARCHAR(100),
  instantly_campaign_id VARCHAR(255),
  personalization_strategy VARCHAR(100),
  custom_prompt TEXT,
  lead_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0
);

-- 3. Create campaign_leads table
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_data JSONB NOT NULL,
  personalized_message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create AGA Runs progress table (legacy compatibility)
CREATE TABLE IF NOT EXISTS "AGA Runs progress" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(50) DEFAULT 'processing',
  lead_count INTEGER DEFAULT 0,
  source VARCHAR(100),
  campaign_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Client Metrics table
CREATE TABLE IF NOT EXISTS "Client Metrics" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  num_personalized_leads INTEGER DEFAULT 0,
  hours_saved DECIMAL(10,2) DEFAULT 0,
  money_saved DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tokens_value ON tokens(token_value);
CREATE INDEX IF NOT EXISTS idx_tokens_client ON tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_name ON campaigns(name);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON campaign_leads(status);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_data ON campaign_leads USING GIN (lead_data);

-- 7. Create function to increment token usage
CREATE OR REPLACE FUNCTION increment_token_usage(token_val VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE tokens 
  SET usage_count = usage_count + 1 
  WHERE token_value = token_val;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to update campaign stats
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE campaigns 
  SET 
    lead_count = (
      SELECT COUNT(*) FROM campaign_leads 
      WHERE campaign_id = NEW.campaign_id
    ),
    completed_count = (
      SELECT COUNT(*) FROM campaign_leads 
      WHERE campaign_id = NEW.campaign_id 
      AND status = 'completed'
    ),
    updated_at = NOW()
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function for client context (legacy compatibility)
CREATE OR REPLACE FUNCTION set_client_context(client_val VARCHAR)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user', client_val, true);
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger to auto-update campaign stats
CREATE TRIGGER IF NOT EXISTS trigger_update_campaign_stats
  AFTER INSERT OR UPDATE OR DELETE ON campaign_leads
  FOR EACH ROW EXECUTE FUNCTION update_campaign_stats();

-- 11. Insert sample data
INSERT INTO tokens (token_value, client_id, expires_at, usage_limit) VALUES
('demo-token-thirteen-ai', 'mateusz', NOW() + INTERVAL '1 year', 1000),
('power-user-token-admin', 'admin', NOW() + INTERVAL '1 year', NULL),
('unlimited-token-dev', 'developer', NOW() + INTERVAL '1 year', NULL)
ON CONFLICT (token_value) DO NOTHING;

-- 12. Enable Row Level Security (RLS)
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AGA Runs progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client Metrics" ENABLE ROW LEVEL SECURITY;

-- 13. Create RLS policies
-- Tokens: Allow public read for validation
DROP POLICY IF EXISTS "Allow token validation" ON tokens;
CREATE POLICY "Allow token validation" ON tokens
  FOR SELECT USING (active_status = true);

-- Campaigns: Users can access their own campaigns
DROP POLICY IF EXISTS "Users can manage own campaigns" ON campaigns;
CREATE POLICY "Users can manage own campaigns" ON campaigns
  FOR ALL USING (user_id = current_setting('app.current_user', true));

-- Campaign leads: Access through campaign ownership
DROP POLICY IF EXISTS "Users can manage campaign leads" ON campaign_leads;
CREATE POLICY "Users can manage campaign leads" ON campaign_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_leads.campaign_id 
      AND campaigns.user_id = current_setting('app.current_user', true)
    )
  );

-- AGA Runs progress: Public access for legacy compatibility
DROP POLICY IF EXISTS "Allow AGA runs access" ON "AGA Runs progress";
CREATE POLICY "Allow AGA runs access" ON "AGA Runs progress"
  FOR ALL USING (true);

-- Client Metrics: Public access
DROP POLICY IF EXISTS "Allow client metrics access" ON "Client Metrics";
CREATE POLICY "Allow client metrics access" ON "Client Metrics"
  FOR ALL USING (true);

-- Success message
SELECT 'Enhanced database schema created successfully!' as result;