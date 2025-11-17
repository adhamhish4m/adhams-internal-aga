-- Fix critical security vulnerability in campaigns table RLS policies
-- The current "Allow token-based access to campaigns" policy has "true" which allows unrestricted access
-- This needs to be fixed to only allow access when proper client context is set

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Allow token-based access to campaigns" ON campaigns;

-- Create a new, properly restricted token-based policy
-- This policy only allows access when a valid client_id context is set
-- and matches the campaign's user_id (ensuring users can only access their own campaigns)
CREATE POLICY "Allow token-based access to own campaigns" ON campaigns
  FOR ALL
  USING (
    (user_id)::text = current_setting('app.current_client_id'::text, true)
    AND current_setting('app.current_client_id'::text, true) IS NOT NULL
    AND current_setting('app.current_client_id'::text, true) != ''
  )
  WITH CHECK (
    (user_id)::text = current_setting('app.current_client_id'::text, true)
    AND current_setting('app.current_client_id'::text, true) IS NOT NULL
    AND current_setting('app.current_client_id'::text, true) != ''
  );

-- Also fix the same issue in campaign_leads table
DROP POLICY IF EXISTS "Allow token-based access to campaign leads" ON campaign_leads;

-- Create properly restricted policy for campaign_leads
CREATE POLICY "Allow token-based access to own campaign leads" ON campaign_leads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_leads.campaign_id 
      AND (campaigns.user_id)::text = current_setting('app.current_client_id'::text, true)
      AND current_setting('app.current_client_id'::text, true) IS NOT NULL
      AND current_setting('app.current_client_id'::text, true) != ''
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_leads.campaign_id 
      AND (campaigns.user_id)::text = current_setting('app.current_client_id'::text, true)
      AND current_setting('app.current_client_id'::text, true) IS NOT NULL
      AND current_setting('app.current_client_id'::text, true) != ''
    )
  );