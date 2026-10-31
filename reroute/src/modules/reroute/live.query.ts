import { queryOptions } from '@tanstack/react-query';
import { readWorldwideSnapshot } from './live.functions';
import { LIVE_REFRESH_MS } from './live';
import { JAVA_URL } from './client';
import type { LiveSnapshot } from './live';
export async function fetchStoredFlights(search = '', airport = '', page = 0): Promise<LiveSnapshot> {
    if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      try {
        const response = await fetch(`${JAVA_URL}/api/reroute/live-flights?${new URLSearchParams({ search, airport, page: String(page) })}`, { signal: AbortSignal.timeout(2000) });
        if (response.ok) return await response.json() as LiveSnapshot;
      } catch { /* Local Java offline: use the shared Cloud observation. */ }
    }
    return readWorldwideSnapshot({ data: { search, airport, page } });
}
export const worldwideSnapshotOptions = (search = '', airport = '', page = 0) => queryOptions({
  queryKey: ['reroute', 'live-aircraft', search, airport, page], queryFn: () => fetchStoredFlights(search, airport, page),
  refetchInterval: LIVE_REFRESH_MS, staleTime: 0, retry: false,
});
export const liveSnapshotOptions = worldwideSnapshotOptions();