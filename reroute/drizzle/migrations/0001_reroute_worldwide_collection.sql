CREATE TABLE public.reroute_airport_coverage (
  code text PRIMARY KEY,
  observed_at timestamptz,
  attempted_at timestamptz,
  lease_until timestamptz,
  last_error text,
  flight_count integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.reroute_airport_coverage TO anon, authenticated;
GRANT ALL ON public.reroute_airport_coverage TO service_role;
ALTER TABLE public.reroute_airport_coverage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public airport coverage" ON public.reroute_airport_coverage FOR SELECT TO anon, authenticated USING (true);
CREATE OR REPLACE FUNCTION public.reroute_claim_airports(batch_size integer)
RETURNS SETOF text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF batch_size < 1 OR batch_size > 100 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
  RETURN QUERY
  WITH due AS (
    SELECT code FROM public.reroute_airport_coverage
    WHERE (attempted_at IS NULL OR attempted_at <= now() - interval '10 minutes')
      AND (lease_until IS NULL OR lease_until < now())
    ORDER BY attempted_at NULLS FIRST, code
    LIMIT batch_size FOR UPDATE SKIP LOCKED
  )
  UPDATE public.reroute_airport_coverage c SET lease_until = now() + interval '2 minutes'
  FROM due WHERE c.code = due.code RETURNING c.code;
END;
$$;
REVOKE ALL ON FUNCTION public.reroute_claim_airports(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reroute_claim_airports(integer) TO service_role;
CREATE OR REPLACE FUNCTION public.reroute_worldwide_page(search_term text DEFAULT '', airport_code text DEFAULT '', page_number integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
WITH snapshots AS (
 SELECT scope, aircraft, observed_at, fetched_at FROM public.reroute_live_snapshots
 WHERE source = 'AeroDataBox' AND (scope LIKE 'airport:%' OR (scope = 'romania' AND NOT EXISTS (
   SELECT 1 FROM public.reroute_live_snapshots WHERE source = 'AeroDataBox' AND scope = 'airport:LROP'
 )))
), records AS (
 SELECT DISTINCT ON (a->>'callsign', a->>'origin', a->>'destination', coalesce(a->>'scheduledDeparture', a->>'scheduledArrival'))
 a || jsonb_build_object('snapshotAt', observed_at) AS aircraft, observed_at
 FROM snapshots CROSS JOIN LATERAL jsonb_array_elements(aircraft) a
 WHERE (airport_code = '' OR scope = 'airport:' || upper(airport_code) OR (upper(airport_code) = 'LROP' AND scope = 'romania'))
 AND (search_term = '' OR strpos(lower(concat_ws(' ', a->>'callsign', a->>'origin', a->>'destination', a->>'airline')), lower(left(search_term, 100))) > 0)
 ORDER BY a->>'callsign', a->>'origin', a->>'destination', coalesce(a->>'scheduledDeparture', a->>'scheduledArrival'), observed_at DESC
), paged AS (
 SELECT aircraft FROM records ORDER BY coalesce(aircraft->>'scheduledDeparture', aircraft->>'scheduledArrival'), aircraft->>'id'
 LIMIT 50 OFFSET least(greatest(page_number, 0), 100000) * 50
)
SELECT jsonb_build_object(
 'aircraft', coalesce((SELECT jsonb_agg(aircraft) FROM paged), '[]'::jsonb),
 'observedAt', (SELECT min(observed_at) FROM snapshots),
 'fetchedAt', (SELECT max(fetched_at) FROM snapshots),
 'totalFlights', (SELECT count(*) FROM records),
 'page', greatest(page_number, 0), 'pageSize', 50,
 'coverage', jsonb_build_object(
  'supported', (SELECT count(*) FROM public.reroute_airport_coverage),
  'loaded', (SELECT count(*) FROM snapshots),
  'failed', (SELECT count(*) FROM public.reroute_airport_coverage WHERE last_error IS NOT NULL),
  'stale', (SELECT count(*) FROM snapshots WHERE observed_at < now() - interval '20 minutes'),
  'airports', coalesce((SELECT jsonb_agg(code ORDER BY code) FROM public.reroute_airport_coverage), '[]'::jsonb)
 )
);
$$;
REVOKE ALL ON FUNCTION public.reroute_worldwide_page(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reroute_worldwide_page(text,text,integer) TO anon, authenticated, service_role;