-- Create a read-only policy so the app can display metrics for 'mateusz' publicly
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'Client Metrics' AND policyname = 'Public can read mateusz metrics'
  ) THEN
    CREATE POLICY "Public can read mateusz metrics"
    ON public."Client Metrics"
    FOR SELECT
    USING (client_name = 'mateusz');
  END IF;
END $$;