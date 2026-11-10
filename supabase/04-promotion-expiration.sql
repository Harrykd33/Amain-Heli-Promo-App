-- Run in Supabase after the earlier migrations. Safe to rerun; preserves all records.
-- Completed is derived from this date in the app, so no scheduled job or deletion is needed.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promotion_expires_on date;
COMMENT ON COLUMN public.products.promotion_expires_on IS 'Promotion remains active through this date in America/New_York; appears in Completed the following day. NULL means no expiration.';
COMMIT;
