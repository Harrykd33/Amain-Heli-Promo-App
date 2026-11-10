-- Safe to rerun for this app schema; existing records are preserved.
-- Run in the Supabase SQL Editor, then run 02-import-workbook.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS public.team_members (
  email text PRIMARY KEY CHECK (email = lower(email)),
  added_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.team_members(email) VALUES
 ('kevndrc@gmail.com'), ('jasonb@amain.com'), ('datams@aol.com'), ('jbell.smack@gmail.com') ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_flight_team_member() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.team_members WHERE email=lower(auth.jwt()->>'email'));
$$;
REVOKE ALL ON FUNCTION public.is_flight_team_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_flight_team_member() TO authenticated;

CREATE TABLE IF NOT EXISTS public.manufacturers (
 name text PRIMARY KEY CHECK(length(trim(name)) BETWEEN 1 AND 500),
 category text NOT NULL DEFAULT '' CHECK(length(category)<=500),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=6000),
 discount text NOT NULL DEFAULT '' CHECK(length(discount)<=500)
);
CREATE TABLE IF NOT EXISTS public.products (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 status text NOT NULL DEFAULT 'On track' CHECK(status IN ('On track','In progress','Blocked','On hold')),
 manufacturer text NOT NULL CHECK(length(trim(manufacturer)) BETWEEN 1 AND 500),
 product text NOT NULL CHECK(length(trim(product)) BETWEEN 1 AND 500),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 eta date, received date,
 assigned text NOT NULL DEFAULT '' CHECK(length(assigned)<=500),
 unbox text NOT NULL DEFAULT '' CHECK(unbox IN ('','Not started','In progress','Done','N/A')),
 build text NOT NULL DEFAULT '' CHECK(build IN ('','Not started','In progress','Done','N/A')),
 flights text NOT NULL DEFAULT '' CHECK(flights IN ('','Not started','In progress','Done','N/A')),
 review text NOT NULL DEFAULT '' CHECK(review IN ('','Not started','In progress','Done','N/A')),
 editing text NOT NULL DEFAULT '' CHECK(editing IN ('','Not started','In progress','Done','N/A')),
 fb text NOT NULL DEFAULT '' CHECK(fb IN ('','Not started','In progress','Done','N/A')),
 ig text NOT NULL DEFAULT '' CHECK(ig IN ('','Not started','In progress','Done','N/A')),
 yt text NOT NULL DEFAULT '' CHECK(yt IN ('','Not started','In progress','Done','N/A')),
 links text NOT NULL DEFAULT '' CHECK(length(links)<=6000),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=6000),
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by text NOT NULL DEFAULT 'Workbook import'
);
CREATE OR REPLACE FUNCTION public.stamp_product_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.updated_at=now();
 NEW.updated_by=coalesce(lower(auth.jwt()->>'email'),'Workbook import');
 IF TG_OP='UPDATE' THEN
   NEW.id=OLD.id;
   NEW.revision=OLD.revision+1;
 ELSE
   NEW.revision=1;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS product_update_stamp ON public.products;
CREATE TRIGGER product_update_stamp BEFORE INSERT OR UPDATE ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.stamp_product_update();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_members,public.manufacturers,public.products FROM anon,authenticated;
GRANT SELECT ON public.team_members TO authenticated;
GRANT SELECT,INSERT ON public.manufacturers TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.products TO authenticated;
DROP POLICY IF EXISTS member_self_read ON public.team_members;
CREATE POLICY member_self_read ON public.team_members FOR SELECT TO authenticated
 USING (email=lower(auth.jwt()->>'email'));
DROP POLICY IF EXISTS manufacturer_read ON public.manufacturers;
CREATE POLICY manufacturer_read ON public.manufacturers FOR SELECT TO authenticated
 USING ((SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS manufacturer_add ON public.manufacturers;
CREATE POLICY manufacturer_add ON public.manufacturers FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS product_read ON public.products;
CREATE POLICY product_read ON public.products FOR SELECT TO authenticated
 USING ((SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS product_add ON public.products;
CREATE POLICY product_add ON public.products FOR INSERT TO authenticated
 WITH CHECK ((SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS product_edit ON public.products;
CREATE POLICY product_edit ON public.products FOR UPDATE TO authenticated
 USING ((SELECT public.is_flight_team_member())) WITH CHECK ((SELECT public.is_flight_team_member()));
CREATE INDEX IF NOT EXISTS products_updated_at_idx ON public.products(updated_at DESC);
COMMIT;
