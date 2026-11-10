-- Run after migrations 01-05. Preserves and imports existing contact details.
BEGIN;
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS contacts jsonb;
UPDATE public.manufacturers SET contacts=CASE WHEN contact_name<>'' OR email<>'' OR phone<>'' OR website<>'' THEN jsonb_build_array(jsonb_build_object('name',contact_name,'email',email,'phone',phone,'website',website,'facebook','','notes','')) ELSE '[]'::jsonb END WHERE contacts IS NULL;
ALTER TABLE public.manufacturers ALTER COLUMN contacts SET DEFAULT '[]'::jsonb;
ALTER TABLE public.manufacturers ALTER COLUMN contacts SET NOT NULL;
CREATE OR REPLACE FUNCTION public.valid_brand_contacts(value jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item jsonb; field text;
BEGIN
 IF jsonb_typeof(value)<>'array' THEN RETURN false; END IF;
 IF jsonb_array_length(value)>30 THEN RETURN false; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(value) LOOP
  IF jsonb_typeof(item)<>'object' THEN RETURN false; END IF;
  FOREACH field IN ARRAY ARRAY['name','email','phone','website','facebook','notes'] LOOP
   IF item ? field AND (jsonb_typeof(item->field)<>'string' OR length(item->>field)>CASE WHEN field='notes' THEN 6000 ELSE 500 END) THEN RETURN false; END IF;
  END LOOP;
 END LOOP;
 RETURN true;
END; $$;
ALTER TABLE public.manufacturers DROP CONSTRAINT IF EXISTS manufacturers_contacts_valid;
ALTER TABLE public.manufacturers ADD CONSTRAINT manufacturers_contacts_valid CHECK(public.valid_brand_contacts(contacts));
COMMIT;
