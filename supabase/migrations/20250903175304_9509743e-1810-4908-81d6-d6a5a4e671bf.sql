-- Add campaign_name column to AGA Runs progress table
ALTER TABLE "AGA Runs progress" 
ADD COLUMN campaign_name TEXT;