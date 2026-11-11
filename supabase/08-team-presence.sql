-- Run after migrations 01-07. Authorizes the private team presence channel.
BEGIN;
DROP POLICY IF EXISTS flight_team_presence_read ON realtime.messages;
CREATE POLICY flight_team_presence_read ON realtime.messages FOR SELECT TO authenticated
USING (extension = 'presence' AND (SELECT realtime.topic()) = 'flight-team-online' AND (SELECT public.is_flight_team_member()));
DROP POLICY IF EXISTS flight_team_presence_write ON realtime.messages;
CREATE POLICY flight_team_presence_write ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (extension = 'presence' AND (SELECT realtime.topic()) = 'flight-team-online' AND (SELECT public.is_flight_team_member()));
COMMIT;
