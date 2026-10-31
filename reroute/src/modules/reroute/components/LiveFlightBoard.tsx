import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { worldwideSnapshotOptions } from '../live.query';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { LIVE_REFRESH_MS, canSimulateCancellation } from '../live';
import { useSimulation } from '../useSimulation';
import { simulateFlight } from '../simulation';
import { supabase } from '@/integrations/supabase/client';
import { refreshLiveFlights } from '../refresh.functions';

export function LiveFlightBoard() {
  const queryClient = useQueryClient();
  const updateFlights = useServerFn(refreshLiveFlights);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const airport = 'LROP';
  const [page, setPage] = useState(0);
  const { data, isFetching, error, refetch } = useSuspenseQuery(worldwideSnapshotOptions(filter, airport, page));
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const simulation = useSimulation();
  const stale = data && now !== null && now - Date.parse(data.observedAt) > LIVE_REFRESH_MS * 2;
  const observed = new Map((data?.aircraft ?? []).map(a => [a.id, a]));
  const aircraft = [...observed.values()].filter(a => now === null || canSimulateCancellation(a, now));
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true); setRefreshFailed(false); setRefreshMessage('');
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        await updateFlights();
        await queryClient.invalidateQueries({ queryKey: ['reroute'] });
        setRefreshMessage('AeroDataBox updated. Flight schedules and recommendations are refreshed.');
      } else {
        const result = await refetch();
        if (result.error) throw result.error;
        const outdated = Date.now() - Date.parse(result.data?.observedAt ?? '') > LIVE_REFRESH_MS * 2;
        setRefreshMessage(outdated
          ? 'Saved flights reloaded, but AeroDataBox data is still outdated. Live manual updates require a signed-in operator; automatic updates require the app to be published.'
          : 'Latest saved flights loaded. Live manual updates require a signed-in operator; automatic updates require the app to be published.');
      }
      setNow(Date.now());
    } catch (cause) {
      setRefreshFailed(true);
      setRefreshMessage(cause instanceof Error ? `Refresh failed: ${cause.message}. The last flight update is retained.` : 'Refresh failed. The last flight update is retained.');
    } finally { setRefreshing(false); }
  };
  const displayTime = (value?: string) => value ? new Date(value).toISOString().slice(5, 16).replace('T', ' ') + ' UTC' : '—';
  return <section className="space-y-4 border-y border-border py-6" aria-label="Live flights">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">OTP departures</h2>
        <p className="text-sm text-muted-foreground">Bucharest · European destinations · next 24 hours</p></div>
      <Button variant="outline" disabled={isFetching || refreshing} onClick={() => void refresh()}><RefreshCw className={`size-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} />{isFetching || refreshing ? 'Refreshing…' : 'Refresh flights'}</Button>
    </div>
    {refreshMessage && <p role={refreshFailed ? 'alert' : 'status'} className={`text-sm ${refreshFailed ? 'text-destructive' : 'text-muted-foreground'}`}>{refreshMessage}</p>}
    {data?.coverage && <div className="space-y-1 border-l-2 border-primary pl-3 text-sm" aria-label="Airport coverage">
      <p>OTP · {data.coverage.loaded ? 'Schedule loaded' : 'Awaiting schedule'} · {data.coverage.stale} outdated</p>
    </div>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <form className="flex w-full flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(0); setFilter(search); }}>
        <input aria-label="Search flights" placeholder="Flight, airline or airport" value={search} onChange={e => setSearch(e.target.value)} className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <p className={`text-sm ${stale || error ? 'text-destructive' : 'text-muted-foreground'}`}>
        {data?.observedAt ? `${(data.totalFlights ?? data.aircraft.length).toLocaleString()} matching flights · oldest update ${new Date(data.observedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC${stale ? ' · outdated data' : ''}` : 'The first AeroDataBox update is not available yet'}
      </p>
    </div>
    <div className="flex items-center justify-end gap-3" aria-label="Flight pages">
      <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.max(1, Math.ceil((data?.totalFlights ?? 0) / 50))}</span>
      <Button size="icon" variant="outline" aria-label="Previous page" title="Previous page" disabled={page === 0 || isFetching} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Button>
      <Button size="icon" variant="outline" aria-label="Next page" title="Next page" disabled={(page + 1) * 50 >= (data?.totalFlights ?? 0) || isFetching} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Refresh failed. The last flight update has been retained.</p>}
    <div className="max-h-96 overflow-auto">
      <table className="w-full min-w-[720px] text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr>
        {['Flight / airline', 'Route', 'Scheduled (UTC)', 'Airline status', 'Local simulation', ''].map(h => <th key={h} className="p-2">{h}</th>)}
      </tr></thead><tbody>{aircraft.map(a => {
        const cancelled = simulation.flights[a.id]?.cancelled === true;
        return <tr key={a.id} className="border-t border-border">
          <td className="board p-2">{a.callsign || '—'}<span className="block text-xs text-muted-foreground">{a.airline}</span></td>
          <td className="p-2">{a.origin} → {a.destination}</td><td className="p-2">{displayTime(a.scheduledDeparture)}<span className="block text-xs text-muted-foreground">Arrival {displayTime(a.scheduledArrival)}</span></td>
          <td className="p-2">{!data?.aircraft.some(current => current.id === a.id) ? 'Outside current window' : a.officialStatus}</td>
          <td className={`p-2 ${cancelled ? 'text-destructive' : 'text-muted-foreground'}`}>{cancelled ? 'Cancelled in simulation' : 'Unchanged'}</td>
          <td className="p-2"><Button size="sm" variant={cancelled ? 'outline' : 'destructive'} disabled={!cancelled && !canSimulateCancellation(a, now ?? Date.now())} onClick={() => { simulateFlight(a, !cancelled); setNow(Date.now()); }}>{cancelled ? 'Restore booking' : 'Simulate cancellation'}</Button></td>
        </tr>;
      })}{!aircraft.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{data ? 'No flights found.' : 'Waiting for the first AeroDataBox update.'}</td></tr>}</tbody></table>
    </div>
    <p className="text-xs text-muted-foreground">Airline status is separate from simulated cancellations. No passenger manifests or bookable seat inventory. Simulations use demo passengers on this browser only.</p>
    <a href="https://aerodatabox.com" target="_blank" rel="noreferrer" className="text-xs text-primary underline">Source: AeroDataBox via RapidAPI</a>
  </section>;
}