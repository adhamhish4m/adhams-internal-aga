-- REVERT SECURITY CHANGES: Properly restore original permissive policies
-- This handles existing policies correctly

-- 1. Drop the secure token verification function
DROP FUNCTION IF EXISTS public.verify_token_and_set_context(text);

-- 2. Restore execute permission on set_client_context for anon and authenticated
GRANT EXECUTE ON FUNCTION public.set_client_context(text) TO anon, authenticated;

-- 3. Drop the trigger and function first
DROP TRIGGER IF EXISTS trigger_set_client_id_aga_runs ON "AGA Runs progress";
DROP FUNCTION IF EXISTS public.set_client_id_from_context();

-- 4. Handle AGA Runs progress table policies
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Authenticated clients can read own runs" ON "AGA Runs progress";
DROP POLICY IF EXISTS "Authenticated clients can create own runs" ON "AGA Runs progress";
DROP POLICY IF EXISTS "Authenticated clients can update own runs" ON "AGA Runs progress";
DROP POLICY IF EXISTS "Authenticated clients can delete own runs" ON "AGA Runs progress";
DROP POLICY IF EXISTS "Public can read runs" ON "AGA Runs progress";
DROP POLICY IF EXISTS "Public can create runs" ON "AGA Runs progress";
DROP POLICY IF EXISTS "Public can update runs" ON "AGA Runs progress";

-- Create original permissive policies
CREATE POLICY "Public can read runs" ON "AGA Runs progress"
  FOR SELECT
  USING (true);

CREATE POLICY "Public can create runs" ON "AGA Runs progress"
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update runs" ON "AGA Runs progress"
  FOR UPDATE
  USING (true);

-- Restore the default client_id value
ALTER TABLE "AGA Runs progress" ALTER COLUMN client_id SET DEFAULT 'adham'::text;

-- 5. Handle Client Metrics table policies
-- Drop ALL existing policies first
DROP POLICY IF EXISTS "Authenticated clients can read own metrics" ON "Client Metrics";
DROP POLICY IF EXISTS "Authenticated clients can manage own metrics" ON "Client Metrics";
DROP POLICY IF EXISTS "Enable read access for all users" ON "Client Metrics";
DROP POLICY IF EXISTS "Public can read mateusz metrics" ON "Client Metrics";

-- Create original permissive policies
CREATE POLICY "Enable read access for all users" ON "Client Metrics"
  FOR SELECT
  USING (true);

CREATE POLICY "Public can read mateusz metrics" ON "Client Metrics"
  FOR SELECT
  USING (client_name = 'mateusz'::text);

-- Success message
SELECT 'Security changes reverted successfully!' as result;