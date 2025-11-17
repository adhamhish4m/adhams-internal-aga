# Enhanced Database Schema for Thirteen AI

## Required Supabase Tables

To fully implement the enhanced lead generation system, the following tables need to be created in your Supabase database:

### 1. Tokens Table
```sql
CREATE TABLE tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_value VARCHAR(255) UNIQUE NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  usage_count INTEGER DEFAULT 0,
  usage_limit INTEGER,
  active_status BOOLEAN DEFAULT true
);

-- Create index for fast token lookups
CREATE INDEX idx_tokens_value ON tokens(token_value);
CREATE INDEX idx_tokens_client ON tokens(client_id);
```

### 2. Campaigns Table
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'processing',
  user_id VARCHAR(100) NOT NULL,
  source VARCHAR(100),
  instantly_campaign_id VARCHAR(255)
);

-- Create indexes
CREATE INDEX idx_campaigns_user ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_name ON campaigns(name);
```

### 3. Campaign Leads Table
```sql
CREATE TABLE campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_data JSONB NOT NULL,
  personalized_message TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_status ON campaign_leads(status);

-- Create GIN index for lead_data JSONB queries
CREATE INDEX idx_campaign_leads_data ON campaign_leads USING GIN (lead_data);
```

### 4. Token Usage Increment Function
```sql
CREATE OR REPLACE FUNCTION increment_token_usage(token_val VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE tokens 
  SET usage_count = usage_count + 1 
  WHERE token_value = token_val;
END;
$$ LANGUAGE plpgsql;
```

## Sample Data

### Insert Sample Tokens
```sql
INSERT INTO tokens (token_value, client_id, expires_at, usage_limit) VALUES
('demo-token-12345', 'mateusz', NOW() + INTERVAL '1 year', 1000),
('power-user-token-67890', 'admin', NOW() + INTERVAL '1 year', NULL);
```

### Insert Sample Campaign
```sql
INSERT INTO campaigns (name, status, user_id, source) VALUES
('Q1 2024 Outreach', 'completed', 'mateusz', 'Apollo URL');
```

## Row Level Security (RLS) Policies

### Tokens Table Policies
```sql
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own tokens
CREATE POLICY "Users can view own tokens" ON tokens
  FOR SELECT USING (client_id = auth.jwt() ->> 'sub');

-- Allow token validation
CREATE POLICY "Allow token validation" ON tokens
  FOR SELECT USING (active_status = true);
```

### Campaigns Table Policies
```sql
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own campaigns
CREATE POLICY "Users can view own campaigns" ON campaigns
  FOR ALL USING (user_id = auth.jwt() ->> 'sub');
```

### Campaign Leads Table Policies
```sql
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;

-- Allow users to view leads for their campaigns
CREATE POLICY "Users can view own campaign leads" ON campaign_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_leads.campaign_id 
      AND campaigns.user_id = auth.jwt() ->> 'sub'
    )
  );
```

## Implementation Steps

1. **Connect to Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Execute Schema Creation**
   - Run the table creation SQL above
   - Add the indexes and function
   - Insert sample data

3. **Set up RLS Policies**
   - Execute the RLS policies for security
   - Test with sample data

4. **Update Supabase Types**
   - The existing `src/integrations/supabase/types.ts` will need to be regenerated
   - Use Supabase CLI: `supabase gen types typescript --project-id YOUR_PROJECT_ID`

5. **Replace Components**
   - Replace `SimplifiedEnhancedForm` with `EnhancedLeadForm`
   - Replace `SimplifiedCampaignPage` with `CampaignPage`
   - Update imports in `src/App.tsx` and `src/pages/Index.tsx`

## Benefits of Enhanced Schema

- **Token Authentication**: Secure access control with usage tracking
- **Campaign Management**: Organized lead campaigns with detailed tracking
- **Lead Details**: Store complete lead information and personalized messages
- **Power User Features**: Enhanced personalization strategies
- **Real-time Updates**: Live campaign status and progress tracking
- **Export Capabilities**: Full CSV export with all lead data
- **Scalability**: Optimized indexes for performance at scale

## Current Limitations (with existing schema)

The current implementation uses simplified components that work with the existing `AGA Runs progress` table but don't include:
- Token authentication
- Individual lead tracking
- Personalized message storage
- Enhanced campaign details
- Full CSV export capabilities

Once the enhanced schema is implemented, these features will be fully functional.