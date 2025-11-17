-- Create AGA Runs progress table
CREATE TABLE public."AGA Runs progress" (
  run_id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Processing Leads',
  lead_count INTEGER,
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public."AGA Runs progress" ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Public can read runs" 
ON public."AGA Runs progress" 
FOR SELECT 
USING (true);

-- Create policy for public insert (for creating new runs)
CREATE POLICY "Public can create runs" 
ON public."AGA Runs progress" 
FOR INSERT 
WITH CHECK (true);

-- Create policy for public updates (for n8n to update status)
CREATE POLICY "Public can update runs" 
ON public."AGA Runs progress" 
FOR UPDATE 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_runs_updated_at
BEFORE UPDATE ON public."AGA Runs progress"
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for the table
ALTER TABLE public."AGA Runs progress" REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public."AGA Runs progress";