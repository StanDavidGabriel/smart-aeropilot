export const LIVE_REFRESH_MS = 10 * 60 * 1000;
export const LIVE_AIRPORT = 'OTP';
/** Curated important passenger hubs; both ends must be in this European network. */
export const EUROPE_AIRPORTS = [
  { code: 'EGLL', iata: 'LHR', name: 'London Heathrow' }, { code: 'EGKK', iata: 'LGW', name: 'London Gatwick' },
  { code: 'LFPG', iata: 'CDG', name: 'Paris Charles de Gaulle' }, { code: 'LFPO', iata: 'ORY', name: 'Paris Orly' },
  { code: 'EDDF', iata: 'FRA', name: 'Frankfurt' }, { code: 'EDDM', iata: 'MUC', name: 'Munich' },
  { code: 'EDDB', iata: 'BER', name: 'Berlin' }, { code: 'EHAM', iata: 'AMS', name: 'Amsterdam' },
  { code: 'LEMD', iata: 'MAD', name: 'Madrid' }, { code: 'LEBL', iata: 'BCN', name: 'Barcelona' },
  { code: 'LIRF', iata: 'FCO', name: 'Rome Fiumicino' }, { code: 'LIMC', iata: 'MXP', name: 'Milan Malpensa' },
  { code: 'LTFM', iata: 'IST', name: 'Istanbul' }, { code: 'EIDW', iata: 'DUB', name: 'Dublin' },
  { code: 'LSZH', iata: 'ZRH', name: 'Zurich' }, { code: 'LSGG', iata: 'GVA', name: 'Geneva' },
  { code: 'LOWW', iata: 'VIE', name: 'Vienna' }, { code: 'EBBR', iata: 'BRU', name: 'Brussels' },
  { code: 'EKCH', iata: 'CPH', name: 'Copenhagen' }, { code: 'ENGM', iata: 'OSL', name: 'Oslo' },
  { code: 'ESSA', iata: 'ARN', name: 'Stockholm' }, { code: 'EFHK', iata: 'HEL', name: 'Helsinki' },
  { code: 'LPPT', iata: 'LIS', name: 'Lisbon' }, { code: 'LGAV', iata: 'ATH', name: 'Athens' },
  { code: 'EPWA', iata: 'WAW', name: 'Warsaw' }, { code: 'LKPR', iata: 'PRG', name: 'Prague' },
  { code: 'LHBP', iata: 'BUD', name: 'Budapest' }, { code: 'LROP', iata: 'OTP', name: 'Bucharest' },
] as const;
export const DEPARTURE_WINDOW_MS = 24 * 60 * 60 * 1000;
export function isEuropeanHub(code?: string) {
  return EUROPE_AIRPORTS.some(a => a.code === code || a.iata === code);
}
export function canSimulateCancellation(flight: LiveAircraft, now = Date.now()) {
  const departure = Date.parse(flight.scheduledDeparture ?? '');
  const status = (flight.officialStatus ?? '').toLowerCase().replace(/[\s_-]/g, '');
  return isEuropeanHub(flight.origin) && isEuropeanHub(flight.destination)
    && Number.isFinite(departure) && departure > now && departure <= now + DEPARTURE_WINDOW_MS
    && !flight.actualDeparture && ['expected', 'scheduled', 'checkin', 'boarding', 'gateclosed', 'delayed'].includes(status);
}
export interface LiveAircraft {
  id: string; callsign: string; country: string; latitude: number | null;
  longitude: number | null; altitude: number | null; speed: number | null; onGround: boolean;
  origin?: string; destination?: string; scheduledDeparture?: string; scheduledArrival?: string;
  officialStatus?: string; airline?: string; actualDeparture?: string | undefined; scheduleSource?: 'simulated' | 'live';
}
export interface LiveSnapshot { aircraft: LiveAircraft[]; observedAt: string; fetchedAt: string;
  totalFlights?: number; page?: number; pageSize?: number;
  coverage?: { supported: number; loaded: number; failed: number; stale: number; airports: string[]; enabled?: boolean };
}
export function worldwideAirportPath(code: string, offsetMinutes = 0) {
  if (!/^[A-Z0-9]{3,4}$/.test(code)) throw new Error('Invalid airport code');
  return `/flights/airports/icao/${code}?offsetMinutes=${offsetMinutes}&durationMinutes=720&direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLeg=true`;
}
export const europeanAirportPaths = (code: string) => [worldwideAirportPath(code), worldwideAirportPath(code, 720)];
export function normalizeCoverage(input: unknown): string[] {
  const body = input as { items?: unknown } | null;
  if (!body || !Array.isArray(body.items) || !body.items.every(code => typeof code === 'string' && /^[A-Z0-9]{3,4}$/.test(code))) throw new Error('Invalid airport coverage');
  return [...new Set(body.items as string[])].sort();
}
export function selectDueAirports(rows: { code: string; attemptedAt: number | null; leaseUntil: number | null }[], now: number, limit: number) {
  return rows.filter(row => (row.attemptedAt === null || now - row.attemptedAt >= LIVE_REFRESH_MS) && (row.leaseUntil === null || row.leaseUntil < now))
    .sort((a, b) => (a.attemptedAt ?? -Infinity) - (b.attemptedAt ?? -Infinity) || a.code.localeCompare(b.code)).slice(0, limit).map(row => row.code);
}
export function aeroDataBoxPath(now = new Date()) {
  const local = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const part = (type: string) => parts.find(p => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
  };
  return `/flights/airports/iata/${LIVE_AIRPORT}/${local(now)}/${local(new Date(now.getTime() + 12 * 3600000))}?direction=Departure&withCancelled=false&withCodeshared=false&withCargo=false&withPrivate=false&withLeg=true`;
}
type Movement = { airport?: { iata?: string; icao?: string }; scheduledTime?: { utc?: string }; actualTime?: { utc?: string }; runwayTime?: { utc?: string } };
type ProviderFlight = { number?: string; status?: string; airline?: { name?: string }; departure?: Movement; arrival?: Movement };
export function normalizeAeroDataBox(input: unknown, now = new Date(), airport = LIVE_AIRPORT): { aircraft: LiveAircraft[]; observedAt: string } {
  if (!input || typeof input !== 'object') throw new Error('Invalid AeroDataBox response');
  const body = input as { departures?: unknown; arrivals?: unknown };
  if (!Array.isArray(body.departures) && !Array.isArray(body.arrivals)) throw new Error('Invalid AeroDataBox flight records');
  const flights = new Map<string, LiveAircraft>();
  const time = (value?: string) => {
    if (!value) return undefined;
    const millis = Date.parse(value.replace(' ', 'T'));
    return Number.isFinite(millis) ? new Date(millis).toISOString() : undefined;
  };
  for (const direction of ['departures', 'arrivals'] as const) {
    for (const raw of (body[direction] ?? []) as unknown[]) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as ProviderFlight;
      if (typeof row.number !== 'string') continue;
      const origin = direction === 'departures' ? row.departure?.airport?.iata ?? row.departure?.airport?.icao ?? airport : row.departure?.airport?.iata ?? row.departure?.airport?.icao ?? 'Unknown';
      const destination = direction === 'arrivals' ? row.arrival?.airport?.iata ?? row.arrival?.airport?.icao ?? airport : row.arrival?.airport?.iata ?? row.arrival?.airport?.icao ?? 'Unknown';
      const scheduledDeparture = time(row.departure?.scheduledTime?.utc);
      const scheduledArrival = time(row.arrival?.scheduledTime?.utc);
      const identityTime = scheduledDeparture ?? scheduledArrival;
      if (!identityTime) continue;
      const callsign = row.number.replace(/\s/g, '');
      const id = `adb:${callsign}:${origin}:${destination}:${identityTime}`;
      flights.set(id, { id, callsign, country: '', latitude: null, longitude: null, altitude: null, speed: null, onGround: false,
        origin, destination, ...(scheduledDeparture ? { scheduledDeparture } : {}), ...(scheduledArrival ? { scheduledArrival } : {}),
        actualDeparture: time(row.departure?.actualTime?.utc) ?? time(row.departure?.runwayTime?.utc), officialStatus: row.status ?? 'Unknown', airline: row.airline?.name ?? '' });
    }
  }
  return { aircraft: [...flights.values()], observedAt: now.toISOString() };
}
export function simulationStatus(id: string, cancellations: ReadonlySet<string>) {
  return cancellations.has(id) ? 'cancelled' : 'unchanged';
}