-- Fix critical security vulnerability in tokens table RLS policy
-- The current policy allows public read access to ALL tokens which exposes sensitive authentication data
-- This needs to be restricted to only allow token validation for specific tokens when needed

-- Drop the overly permissive public read policy
DROP POLICY IF EXISTS "Public can read tokens for validation" ON tokens;

-- Create a new, properly restricted policy for token validation
-- This policy only allows reading a token when the client context matches the token's client_id
-- This prevents unauthorized access to other clients' tokens
CREATE POLICY "Allow token validation for own client" ON tokens
  FOR SELECT
  USING (
    active_status = true 
    AND (client_id)::text = current_setting('app.current_client_id'::text, true)
    AND current_setting('app.current_client_id'::text, true) IS NOT NULL
    AND current_setting('app.current_client_id'::text, true) != ''
  );

-- Also create a function-based policy that allows the increment_token_usage function to work
-- This is needed for the system to update token usage counts
CREATE POLICY "Allow system token updates" ON tokens
  FOR UPDATE
  USING (
    active_status = true 
    AND (client_id)::text = current_setting('app.current_client_id'::text, true)
    AND current_setting('app.current_client_id'::text, true) IS NOT NULL
    AND current_setting('app.current_client_id'::text, true) != ''
  )
  WITH CHECK (
    active_status = true 
    AND (client_id)::text = current_setting('app.current_client_id'::text, true)
    AND current_setting('app.current_client_id'::text, true) IS NOT NULL
    AND current_setting('app.current_client_id'::text, true) != ''
  );