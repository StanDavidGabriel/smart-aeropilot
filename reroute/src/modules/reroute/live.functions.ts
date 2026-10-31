import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { LiveSnapshot, LiveAircraft } from './live';
import { canSimulateCancellation } from './live';

export const readLiveSnapshot = createServerFn({ method: 'GET' }).handler(async (): Promise<LiveSnapshot | null> => {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('Flight database unavailable');
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey', key);
      return fetch(input, { ...init, headers });
    } } });
  const { data, error } = await db.from('reroute_live_snapshots').select('aircraft,observed_at,fetched_at').eq('scope', 'romania').eq('source', 'AeroDataBox').maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { aircraft: data.aircraft as unknown as LiveAircraft[], observedAt: data.observed_at, fetchedAt: data.fetched_at } : null;
});

export const readWorldwideSnapshot = createServerFn({ method: 'GET' })
  .inputValidator((input: { search?: string; airport?: string; page?: number }) => {
    const search = input.search?.trim().slice(0, 100) ?? '';
    const airport = input.airport ?? '';
    if (airport && !/^[A-Z0-9]{3,4}$/.test(airport)) throw new Error('Invalid airport');
    const page = input.page ?? 0;
    if (!Number.isInteger(page) || page < 0 || page > 100000) throw new Error('Invalid page');
    return { search, airport, page };
  }).handler(async ({ data }): Promise<LiveSnapshot> => {
    const url = process.env['SUPABASE_URL'];
    const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error('Flight database unavailable');
    const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith('sb_') && headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
        headers.set('apikey', key);
        return fetch(input, { ...init, headers });
      } } });
    const result = await db.from('reroute_live_snapshots').select('aircraft,observed_at,fetched_at').eq('source', 'AeroDataBox')
      .in('scope', ['romania', 'airport:LROP']).order('fetched_at', { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    const stored = result.data;
    const now = Date.now();
    const rows = (stored?.aircraft as unknown as LiveAircraft[] ?? []).filter(a =>
      (a.origin === 'OTP' || a.origin === 'LROP') && canSimulateCancellation(a, now)
      && (!data.airport || ['OTP', 'LROP'].includes(data.airport))
      && `${a.callsign} ${a.origin} ${a.destination} ${a.airline}`.toLowerCase().includes(data.search.toLowerCase()))
      .sort((a, b) => Date.parse(a.scheduledDeparture ?? '') - Date.parse(b.scheduledDeparture ?? '') || a.id.localeCompare(b.id));
    return { aircraft: rows.slice(data.page * 50, (data.page + 1) * 50), totalFlights: rows.length, page: data.page, pageSize: 50,
      observedAt: stored?.observed_at ?? new Date(now).toISOString(), fetchedAt: stored?.fetched_at ?? new Date(now).toISOString(),
      coverage: { supported: 1, loaded: stored ? 1 : 0, failed: 0, stale: stored && now - Date.parse(stored.observed_at) > 1200000 ? 1 : 0, airports: ['LROP'], enabled: true } };
  });