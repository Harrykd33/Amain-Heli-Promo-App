-- Run after the earlier migrations. Safe to rerun.
BEGIN;
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS display_name text NOT NULL DEFAULT '' CHECK(length(display_name)<=100);
CREATE UNIQUE INDEX IF NOT EXISTS team_members_display_name_unique ON public.team_members(lower(trim(display_name))) WHERE trim(display_name)<>'';
CREATE TABLE IF NOT EXISTS public.team_admins (
 email text PRIMARY KEY REFERENCES public.team_members(email) ON DELETE CASCADE
);
ALTER TABLE public.team_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_admins FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.is_team_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.is_flight_team_member() AND EXISTS(SELECT 1 FROM public.team_admins WHERE email=lower(auth.jwt()->>'email'));
$$;
REVOKE ALL ON FUNCTION public.is_team_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_admin() TO authenticated;
DROP POLICY IF EXISTS member_directory_read ON public.team_members;
CREATE POLICY member_directory_read ON public.team_members FOR SELECT TO authenticated USING ((SELECT public.is_flight_team_member()));
CREATE OR REPLACE FUNCTION public.add_team_member(member_name text,member_email text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_team_admin() THEN RAISE EXCEPTION 'Only a team administrator can add teammates.' USING ERRCODE='42501'; END IF;
 IF length(trim(member_name)) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Enter a teammate name (up to 100 characters).'; END IF;
 IF length(trim(member_email))>254 OR trim(member_email) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter a valid sign-in email.'; END IF;
 INSERT INTO public.team_members(email,display_name) VALUES(lower(trim(member_email)),trim(member_name));
END;
$$;
REVOKE ALL ON FUNCTION public.add_team_member(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_team_member(text,text) TO authenticated;
INSERT INTO public.team_admins(email) VALUES ('kevndrc@gmail.com') ON CONFLICT DO NOTHING;
COMMIT;
