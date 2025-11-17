-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  client_name TEXT,
  company_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Update existing tables to link to user_id instead of client_id
ALTER TABLE public.campaigns
ADD COLUMN user_auth_id UUID REFERENCES auth.users(id);

ALTER TABLE public."AGA Runs Progress"  
ADD COLUMN user_auth_id UUID REFERENCES auth.users(id);

ALTER TABLE public."Client Metrics"
ADD COLUMN user_auth_id UUID REFERENCES auth.users(id);

-- Enable RLS on all tables that should be user-specific
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AGA Runs Progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Client Metrics" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for campaigns
CREATE POLICY "Users can view their own campaigns" 
ON public.campaigns 
FOR SELECT 
USING (auth.uid() = user_auth_id);

CREATE POLICY "Users can create their own campaigns" 
ON public.campaigns 
FOR INSERT 
WITH CHECK (auth.uid() = user_auth_id);

CREATE POLICY "Users can update their own campaigns" 
ON public.campaigns 
FOR UPDATE 
USING (auth.uid() = user_auth_id);

-- Create RLS policies for AGA Runs Progress
CREATE POLICY "Users can view their own runs" 
ON public."AGA Runs Progress"
FOR SELECT 
USING (auth.uid() = user_auth_id);

CREATE POLICY "Users can create their own runs" 
ON public."AGA Runs Progress"
FOR INSERT 
WITH CHECK (auth.uid() = user_auth_id);

-- Create RLS policies for Client Metrics
CREATE POLICY "Users can view their own metrics" 
ON public."Client Metrics"
FOR SELECT 
USING (auth.uid() = user_auth_id);

CREATE POLICY "Users can create their own metrics" 
ON public."Client Metrics"
FOR INSERT 
WITH CHECK (auth.uid() = user_auth_id);

-- Create RLS policies for campaign leads (linked through campaigns)
CREATE POLICY "Users can view their campaign leads" 
ON public.campaign_leads 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE campaigns.id = campaign_leads.campaign_id 
    AND campaigns.user_auth_id = auth.uid()
  )
);

CREATE POLICY "Users can create campaign leads" 
ON public.campaign_leads 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns 
    WHERE campaigns.id = campaign_leads.campaign_id 
    AND campaigns.user_auth_id = auth.uid()
  )
);

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add timestamp update function for profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();