import { canSimulateCancellation, EUROPE_AIRPORTS, type LiveAircraft } from './live';

/** Scheduled suggestions only: no seat availability or booking guarantee. Java mirror: ScheduleRecommendations. */
export function recommendScheduledFlights(cancelled: LiveAircraft, candidates: LiveAircraft[], excluded: ReadonlySet<string>, now = Date.now()): LiveAircraft[] {
  const code = (value?: string) => EUROPE_AIRPORTS.find(a => a.code === value || a.iata === value)?.iata ?? value;
  const departure = Date.parse(cancelled.scheduledDeparture ?? '');
  const unique = new Map<string, LiveAircraft>();
  for (const candidate of candidates) {
    if (candidate.id === cancelled.id || excluded.has(candidate.id) || !canSimulateCancellation(candidate, now)) continue;
    if (code(candidate.origin) !== code(cancelled.origin) || code(candidate.destination) !== code(cancelled.destination)) continue;
    if (!(Date.parse(candidate.scheduledDeparture ?? '') > departure)) continue;
    unique.set(candidate.id, candidate);
  }
  return [...unique.values()].sort((a, b) => Date.parse(a.scheduledDeparture ?? '') - Date.parse(b.scheduledDeparture ?? '') || a.id.localeCompare(b.id)).slice(0, 3);
}

export function scheduleTime(value?: string) {
  return value ? new Date(value).toISOString().slice(5, 16).replace('T', ' ') + ' UTC' : 'Not provided';
}
export interface ScheduledItinerary { legs: LiveAircraft[] }
export const CONNECTION_MINUTES = 45;
export function recommendScheduledItineraries(cancelled: LiveAircraft, candidates: LiveAircraft[], excluded: ReadonlySet<string>, now = Date.now()): ScheduledItinerary[] {
  const code = (value?: string) => EUROPE_AIRPORTS.find(a => a.code === value || a.iata === value)?.iata ?? value;
  const available = [...new Map(candidates.filter(a => a.id !== cancelled.id && !excluded.has(a.id) && canSimulateCancellation(a, now)).map(a => [a.id, a])).values()];
  const departure = Date.parse(cancelled.scheduledDeparture ?? '');
  const routes: ScheduledItinerary[] = [];
  for (const first of available) {
    if (code(first.origin) !== code(cancelled.origin) || !(Date.parse(first.scheduledDeparture ?? '') > departure)) continue;
    if (code(first.destination) === code(cancelled.destination)) { routes.push({ legs: [first] }); continue; }
    const arrival = Date.parse(first.scheduledArrival ?? '');
    if (!Number.isFinite(arrival) || arrival <= Date.parse(first.scheduledDeparture ?? '')) continue;
    for (const second of available) {
      if (second.id === first.id || code(second.origin) !== code(first.destination) || code(second.destination) !== code(cancelled.destination)) continue;
      if (Date.parse(second.scheduledDeparture ?? '') < arrival + CONNECTION_MINUTES * 60000) continue;
      routes.push({ legs: [first, second] });
    }
  }
  const endTime = (route: ScheduledItinerary) => { const last = route.legs.at(-1); return Date.parse(last?.scheduledArrival ?? last?.scheduledDeparture ?? ''); };
  return routes.sort((a, b) => a.legs.length - b.legs.length || endTime(a) - endTime(b) || (a.legs[0]?.id ?? '').localeCompare(b.legs[0]?.id ?? '')).slice(0, 3);
}