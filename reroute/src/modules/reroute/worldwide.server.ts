import { normalizeAeroDataBox, normalizeCoverage, europeanAirportPaths, EUROPE_AIRPORTS, canSimulateCancellation } from './live';

/** Called only after managed cron authentication. Activation requires an approved provider quota. */
export async function collectWorldwideFlights(coverageOnly = false) {
  const key = process.env['UDC_AERODATABOX_API_KEY'];
  const appKey = process.env['LOVABLE_API_KEY'];
  if (!key || !appKey) throw new Error('AeroDataBox connection unavailable');
  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const get = async (path: string) => {
    const response = await fetch(`https://connector-gateway.lovable.dev/udc_aerodatabox${path}`, {
      signal: AbortSignal.timeout(20000), headers: { Authorization: `Bearer ${appKey}`, 'X-Connection-Api-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' },
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('AeroDataBox worldwide refresh failed', response.status, detail);
      throw new Error(`AeroDataBox HTTP ${response.status}: ${detail}`);
    }
    return response.status === 204 ? { arrivals: [], departures: [] } : response.json();
  };
  const { count, error: countError } = await db.from('reroute_airport_coverage').select('code', { count: 'exact', head: true });
  if (countError) throw countError;
  if (!count || coverageOnly) {
    const supported = normalizeCoverage(await get('/health/services/feeds/FlightSchedules/airports'));
    const codes = ['LROP'].filter(code => supported.includes(code));
    for (let i = 0; i < codes.length; i += 500) {
      const { error } = await db.from('reroute_airport_coverage').upsert(codes.slice(i, i + 500).map(code => ({ code })), { onConflict: 'code', ignoreDuplicates: true });
      if (error) throw error;
    }
  }
  if (coverageOnly) return { discoveryOnly: true };
  // The eventual schedule/concurrency must be sized to the provider plan. Never fan out without a configured batch.
  const batchSize = Number(process.env['REROUTE_WORLDWIDE_BATCH_SIZE']);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('Configure approved worldwide batch size (1–100)');
  const claimed = await db.rpc('reroute_claim_airports', { batch_size: batchSize });
  if (claimed.error) throw claimed.error;
  const results = [];
  for (const code of (claimed.data ?? []).filter(code => code === 'LROP')) {
    try {
      const now = new Date();
      const flights = new Map();
      for (const path of europeanAirportPaths(code)) {
        for (const a of normalizeAeroDataBox(await get(path), now, code).aircraft) {
          if (canSimulateCancellation(a, now.getTime())) flights.set(a.id, a);
        }
      }
      const snapshot = { aircraft: [...flights.values()], observedAt: now.toISOString() };
      const { error } = await db.from('reroute_live_snapshots').upsert({ scope: `airport:${code}`, source: 'AeroDataBox', observed_at: snapshot.observedAt,
        fetched_at: new Date().toISOString(), aircraft: JSON.parse(JSON.stringify(snapshot.aircraft)) });
      if (error) throw error;
      const status = await db.from('reroute_airport_coverage').update({ observed_at: snapshot.observedAt, attempted_at: new Date().toISOString(),
        lease_until: null, last_error: null, flight_count: snapshot.aircraft.length }).eq('code', code);
      if (status.error) throw status.error;
      results.push({ code, count: snapshot.aircraft.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Airport refresh failed';
      // Keep previous observations; a failed lease/status write is retried when its lease expires.
      const status = await db.from('reroute_airport_coverage').update({ attempted_at: new Date().toISOString(), lease_until: null, last_error: message }).eq('code', code);
      if (status.error) throw status.error;
      results.push({ code, error: message });
      // Stop on provider quota/auth errors rather than burning the rest of a batch.
      if (/HTTP (401|403|429)/.test(message)) break;
    }
  }
  return { airports: results, complete: false };
}