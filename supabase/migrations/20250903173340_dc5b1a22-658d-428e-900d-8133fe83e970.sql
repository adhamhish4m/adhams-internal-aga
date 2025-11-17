-- Update column types to handle larger numbers
ALTER TABLE "Client Metrics" 
ALTER COLUMN num_personalized_leads TYPE bigint,
ALTER COLUMN hours_saved TYPE bigint;