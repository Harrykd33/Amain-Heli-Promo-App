-- Run after migrations 01-06. Preserves existing product data.
BEGIN;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tutorial text NOT NULL DEFAULT '' CHECK (tutorial IN ('','Not started','In progress','Done','N/A'));
COMMIT;
