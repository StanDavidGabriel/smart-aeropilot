CREATE TABLE public.reroute_live_snapshots (
  scope text PRIMARY KEY,
  source text NOT NULL DEFAULT 'OpenSky Network',
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  aircraft jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT ON public.reroute_live_snapshots TO anon, authenticated;
GRANT ALL ON public.reroute_live_snapshots TO service_role;
ALTER TABLE public.reroute_live_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public aircraft snapshots are readable" ON public.reroute_live_snapshots FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.reroute_live_snapshots IS 'Public aircraft observations only. No passenger data, airline inventory or simulated cancellations.';