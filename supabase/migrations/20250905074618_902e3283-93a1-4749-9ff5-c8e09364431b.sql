-- Add client_id column to AGA Runs progress table
ALTER TABLE "AGA Runs progress" 
ADD COLUMN client_id text DEFAULT 'adham';

-- Add client_id column to Client Metrics table (if not exists)
ALTER TABLE "Client Metrics" 
ADD COLUMN client_id text DEFAULT 'adham';

-- Update existing records to have adham as client_id
UPDATE "AGA Runs progress" SET client_id = 'adham' WHERE client_id IS NULL;
UPDATE "Client Metrics" SET client_id = 'adham' WHERE client_id IS NULL;