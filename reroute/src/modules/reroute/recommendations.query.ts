import { queryOptions } from '@tanstack/react-query';
import { fetchStoredFlights } from './live.query';
import { LIVE_REFRESH_MS, type LiveAircraft } from './live';
import { recommendScheduledItineraries, type ScheduledItinerary } from './recommendations';
import { JAVA_URL } from './client';
import { simulatedEuropeanSchedules } from './simulatedSchedules';

export const recommendationOptions = (flight: LiveAircraft, excluded: string[]) => queryOptions({
  queryKey: ['reroute', 'recommendations', 'simulated-onward-v1', flight.id, ...[...excluded].sort()],
  queryFn: async () => {
    const airport = 'LROP';
    const candidates: LiveAircraft[] = [];
    // Read every matching stored page, not just the 50 rows visible on the board. No paid provider calls.
    const first = await fetchStoredFlights('', airport, 0);
    candidates.push(...first.aircraft);
    const pages = Math.ceil((first.totalFlights ?? first.aircraft.length) / (first.pageSize ?? 50));
    for (let page = 1; page < pages; page++) {
      const next = await fetchStoredFlights('', airport, page);
      candidates.push(...next.aircraft);
    }
    candidates.push(...simulatedEuropeanSchedules(flight.destination));
    if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      try {
        const response = await fetch(`${JAVA_URL}/api/reroute/recommendations`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ flight, candidates, excluded }), signal: AbortSignal.timeout(2000),
        });
        if (response.ok) return await response.json() as ScheduledItinerary[];
      } catch { /* Java offline: identical browser fallback. */ }
    }
    return recommendScheduledItineraries(flight, candidates, new Set(excluded));
  },
  staleTime: 0, refetchInterval: LIVE_REFRESH_MS, retry: false,
});