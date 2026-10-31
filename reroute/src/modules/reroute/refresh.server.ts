import { normalizeAeroDataBox, europeanAirportPaths, canSimulateCancellation, type LiveAircraft } from './live';

/** Call only after user or managed cron authentication; credentials are supplied by the handler. */
export async function refreshOtpFlights(key: string, appKey: string) {
  const now = new Date();
  const flights = new Map<string, LiveAircraft>();
  for (const path of europeanAirportPaths('LROP')) {
    const response = await fetch(`https://connector-gateway.lovable.dev/udc_aerodatabox${path}`, {
      signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${appKey}`, 'X-Connection-Api-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' },
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('AeroDataBox refresh failed', response.status, detail);
      throw new Error(`AeroDataBox refresh failed (${response.status}): ${detail}`);
    }
    const part = normalizeAeroDataBox(response.status === 204 ? { departures: [] } : await response.json(), now);
    for (const flight of part.aircraft) if ((flight.origin === 'OTP' || flight.origin === 'LROP') && canSimulateCancellation(flight, now.getTime())) flights.set(flight.id, flight);
  }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { error } = await supabaseAdmin.from('reroute_live_snapshots').upsert({
    scope: 'romania', source: 'AeroDataBox', observed_at: now.toISOString(),
    fetched_at: new Date().toISOString(), aircraft: JSON.parse(JSON.stringify([...flights.values()])),
  });
  if (error) throw error;
  return { count: flights.size, observedAt: now.toISOString() };
}
