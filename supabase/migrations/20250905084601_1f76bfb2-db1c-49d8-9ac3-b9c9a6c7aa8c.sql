-- Create RLS policies for campaigns table
CREATE POLICY "Users can manage own campaigns" ON campaigns
  FOR ALL USING (
    user_id = current_setting('app.current_client_id', true)
  )
  WITH CHECK (
    user_id = current_setting('app.current_client_id', true)
  );

-- Create RLS policies for campaign_leads table  
CREATE POLICY "Users can manage campaign leads" ON campaign_leads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_leads.campaign_id 
      AND campaigns.user_id = current_setting('app.current_client_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_leads.campaign_id 
      AND campaigns.user_id = current_setting('app.current_client_id', true)
    )
  );

-- Also allow public access for token-based authentication
CREATE POLICY "Allow token-based access to campaigns" ON campaigns
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow token-based access to campaign leads" ON campaign_leads
  FOR ALL USING (true)
  WITH CHECK (true);