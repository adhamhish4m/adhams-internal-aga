-- Fix the AGA Runs Progress table to have proper timestamp defaults
ALTER TABLE public."AGA Runs Progress" 
ALTER COLUMN created_at SET DEFAULT now(),
ALTER COLUMN updated_at SET DEFAULT now();

-- Update existing null timestamps to current time
UPDATE public."AGA Runs Progress" 
SET created_at = now() 
WHERE created_at IS NULL;

UPDATE public."AGA Runs Progress" 
SET updated_at = now() 
WHERE updated_at IS NULL;