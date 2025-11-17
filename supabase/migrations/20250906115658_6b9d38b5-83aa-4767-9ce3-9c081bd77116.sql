-- Fix function security by adding SET search_path = public
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.update_campaign_stats()
RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.increment_token_usage(token_val character varying)
RETURNS void AS $$
BEGIN
  UPDATE tokens 
  SET usage_count = usage_count + 1 
  WHERE token_value = token_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_client_context(client_val character varying)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user', client_val, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;