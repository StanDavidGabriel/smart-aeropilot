import type { LiveAircraft } from './live';

/** Deterministic fictional onward services, not provider observations. Java mirror: simulatedOnward. */
export function simulatedEuropeanSchedules(destination: string | undefined, now = Date.now()): LiveAircraft[] {
  if (!destination || destination === 'OTP') return [];
  const rows: LiveAircraft[] = [];
  const hour = 3600000;
  for (const [index, origin] of ['FRA', 'VIE', 'AMS'].entries()) {
    if (origin === destination) continue;
    for (let at = Math.floor(now / hour) * hour + hour; at <= now + 24 * hour; at += hour) {
      const departure = new Date(at).toISOString();
      const id = `sim:${origin}:${destination}:${departure}`;
      rows.push({ id, callsign: `SIM${index + 1}${new Date(at).getUTCHours().toString().padStart(2, '0')}`,
        origin, destination, scheduledDeparture: departure, scheduledArrival: new Date(at + 2 * hour).toISOString(),
        scheduleSource: 'simulated', officialStatus: 'Scheduled', airline: 'Simulated European network',
        country: '', latitude: null, longitude: null, altitude: null, speed: null, onGround: true });
    }
  }
  return rows;
}