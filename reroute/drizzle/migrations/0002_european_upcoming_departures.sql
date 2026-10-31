CREATE OR REPLACE FUNCTION public.reroute_europe_hubs()
RETURNS TABLE(code text, iata text) LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 VALUES ('EGLL','LHR'),('EGKK','LGW'),('LFPG','CDG'),('LFPO','ORY'),('EDDF','FRA'),('EDDM','MUC'),('EDDB','BER'),('EHAM','AMS'),('LEMD','MAD'),('LEBL','BCN'),('LIRF','FCO'),('LIMC','MXP'),('LTFM','IST'),('EIDW','DUB'),('LSZH','ZRH'),('LSGG','GVA'),('LOWW','VIE'),('EBBR','BRU'),('EKCH','CPH'),('ENGM','OSL'),('ESSA','ARN'),('EFHK','HEL'),('LPPT','LIS'),('LGAV','ATH'),('EPWA','WAW'),('LKPR','PRG'),('LHBP','BUD'),('LROP','OTP');
$$;
REVOKE ALL ON FUNCTION public.reroute_europe_hubs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reroute_europe_hubs() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.reroute_departure_time(value text)
RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN RETURN value::timestamptz; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
$$;
REVOKE ALL ON FUNCTION public.reroute_departure_time(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reroute_departure_time(text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.reroute_claim_airports(batch_size integer)
RETURNS SETOF text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF batch_size < 1 OR batch_size > 100 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
 RETURN QUERY WITH due AS (
 SELECT c.code FROM public.reroute_airport_coverage c
 WHERE c.code IN (SELECT h.code FROM public.reroute_europe_hubs() h)
 AND (attempted_at IS NULL OR attempted_at <= now() - interval '10 minutes')
 AND (lease_until IS NULL OR lease_until < now())
 ORDER BY attempted_at NULLS FIRST, c.code LIMIT batch_size FOR UPDATE SKIP LOCKED
 ) UPDATE public.reroute_airport_coverage c SET lease_until = now() + interval '2 minutes'
 FROM due WHERE c.code = due.code RETURNING c.code;
END;
$$;
REVOKE ALL ON FUNCTION public.reroute_claim_airports(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reroute_claim_airports(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.reroute_worldwide_page(search_term text DEFAULT '', airport_code text DEFAULT '', page_number integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH hubs AS (SELECT * FROM public.reroute_europe_hubs()), snapshots AS (
 SELECT scope, aircraft, observed_at, fetched_at FROM public.reroute_live_snapshots
 WHERE source = 'AeroDataBox' AND (scope IN (SELECT 'airport:' || code FROM hubs) OR (scope = 'romania' AND NOT EXISTS (
 SELECT 1 FROM public.reroute_live_snapshots WHERE source = 'AeroDataBox' AND scope = 'airport:LROP')))
), latest AS (
 SELECT DISTINCT ON (a->>'id') a || jsonb_build_object('snapshotAt', observed_at) AS aircraft, observed_at, scope
 FROM snapshots CROSS JOIN LATERAL jsonb_array_elements(aircraft) a
 ORDER BY a->>'id', observed_at DESC
), records AS (
 SELECT aircraft, observed_at FROM latest
 WHERE EXISTS (SELECT 1 FROM hubs WHERE aircraft->>'origin' IN (code, iata))
 AND EXISTS (SELECT 1 FROM hubs WHERE aircraft->>'destination' IN (code, iata))
 AND public.reroute_departure_time(aircraft->>'scheduledDeparture') > now()
 AND public.reroute_departure_time(aircraft->>'scheduledDeparture') <= now() + interval '24 hours'
 AND coalesce(aircraft->>'actualDeparture', '') = ''
 AND regexp_replace(lower(coalesce(aircraft->>'officialStatus','')), '[[:space:]_-]', '', 'g') IN ('expected','scheduled','checkin','boarding','gateclosed','delayed')
 AND (airport_code = '' OR scope = 'airport:' || upper(airport_code) OR (upper(airport_code) = 'LROP' AND scope = 'romania'))
 AND (search_term = '' OR strpos(lower(concat_ws(' ', aircraft->>'callsign', aircraft->>'origin', aircraft->>'destination', aircraft->>'airline')), lower(left(search_term, 100))) > 0)
), paged AS (
 SELECT aircraft FROM records ORDER BY aircraft->>'scheduledDeparture', aircraft->>'id'
 LIMIT 50 OFFSET least(greatest(page_number, 0), 100000) * 50
)
SELECT jsonb_build_object(
 'aircraft', coalesce((SELECT jsonb_agg(aircraft) FROM paged), '[]'::jsonb),
 'observedAt', (SELECT min(observed_at) FROM snapshots), 'fetchedAt', (SELECT max(fetched_at) FROM snapshots),
 'totalFlights', (SELECT count(*) FROM records), 'page', greatest(page_number, 0), 'pageSize', 50,
 'coverage', jsonb_build_object('supported', (SELECT count(*) FROM hubs), 'loaded', (SELECT count(*) FROM snapshots),
 'failed', (SELECT count(*) FROM public.reroute_airport_coverage WHERE code IN (SELECT code FROM hubs) AND last_error IS NOT NULL),
 'stale', (SELECT count(*) FROM snapshots WHERE observed_at < now() - interval '20 minutes'),
 'airports', (SELECT jsonb_agg(code ORDER BY code) FROM hubs))
);
$$;
REVOKE ALL ON FUNCTION public.reroute_worldwide_page(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reroute_worldwide_page(text,text,integer) TO anon, authenticated, service_role;