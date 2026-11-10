-- Run once in the Supabase SQL Editor for an existing Flight Team workspace.
-- Safe to rerun; preserves products, manufacturers, and notes.
BEGIN;
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS contact_name text NOT NULL DEFAULT '' CHECK(length(contact_name)<=500);
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '' CHECK(length(email)<=500);
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '' CHECK(length(phone)<=500);
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS website text NOT NULL DEFAULT '' CHECK(length(website)<=500);
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.manufacturers ADD COLUMN IF NOT EXISTS updated_by text NOT NULL DEFAULT 'Workbook import';
CREATE TABLE IF NOT EXISTS public.marketing_meetings (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 500),
 meeting_date date NOT NULL,
 attendees text NOT NULL DEFAULT '' CHECK(length(attendees)<=500),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=12000),
 actions text NOT NULL DEFAULT '' CHECK(length(actions)<=6000),
 revision integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by text NOT NULL DEFAULT 'Workbook import'
);
CREATE OR REPLACE FUNCTION public.stamp_workspace_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.updated_at=now(); NEW.updated_by=coalesce(lower(auth.jwt()->>'email'),'Workbook import');
 IF TG_OP='UPDATE' THEN
   NEW.revision=OLD.revision+1;
   IF TG_TABLE_NAME='manufacturers' THEN NEW.name=OLD.name; ELSE NEW.id=OLD.id; END IF;
 ELSE NEW.revision=1;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS manufacturer_update_stamp ON public.manufacturers;
CREATE TRIGGER manufacturer_update_stamp BEFORE INSERT OR UPDATE ON public.manufacturers FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace_update();
DROP TRIGGER IF EXISTS meeting_update_stamp ON public.marketing_meetings;
CREATE TRIGGER meeting_update_stamp BEFORE INSERT OR UPDATE ON public.marketing_meetings FOR EACH ROW EXECUTE FUNCTION public.stamp_workspace_update();
ALTER TABLE public.marketing_meetings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_meetings FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.marketing_meetings TO authenticated;
GRANT UPDATE ON public.manufacturers TO authenticated;
DROP POLICY IF EXISTS manufacturer_edit ON public.manufacturers;
CREATE POLICY manufacturer_edit ON public.manufacturers FOR UPDATE TO authenticated USING ((SELECT public.is_flight_team_member())) WITH CHECK ((SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS meeting_read ON public.marketing_meetings;
CREATE POLICY meeting_read ON public.marketing_meetings FOR SELECT TO authenticated USING ((SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS meeting_add ON public.marketing_meetings;
CREATE POLICY meeting_add ON public.marketing_meetings FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS meeting_edit ON public.marketing_meetings;
CREATE POLICY meeting_edit ON public.marketing_meetings FOR UPDATE TO authenticated USING ((SELECT public.is_flight_team_member())) WITH CHECK ((SELECT public.is_flight_team_member()));
CREATE INDEX IF NOT EXISTS marketing_meetings_date_idx ON public.marketing_meetings(meeting_date DESC);
COMMIT;
