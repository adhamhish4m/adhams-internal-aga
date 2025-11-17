-- Add unique constraint to campaign names within each user's campaigns
ALTER TABLE public.campaigns 
ADD CONSTRAINT unique_campaign_name_per_user 
UNIQUE (name, user_auth_id);