import { describe, expect, it } from 'vitest';
import { simulatedEuropeanSchedules } from './simulatedSchedules';
import { recommendScheduledItineraries } from './recommendations';
import type { LiveAircraft } from './live';
const now = Date.parse('2026-10-31T12:30:00Z');
describe('separate simulated European schedules', () => {
  it('marks every generated onward service as simulated and never generates OTP departures', () => {
    const rows = simulatedEuropeanSchedules('WAW', now);
    expect(rows).toHaveLength(72);
    expect(rows.every(f => f.scheduleSource === 'simulated' && f.origin !== 'OTP' && f.destination === 'WAW')).toBe(true);
    expect(simulatedEuropeanSchedules('WAW', now)).toEqual(rows);
  });
  it('combines a real OTP leg with a labelled simulated onward leg', () => {
    const cancelled: LiveAircraft = { id: 'cancelled', callsign: 'LO644', origin: 'OTP', destination: 'WAW', scheduledDeparture: '2026-11-01T03:35:00Z', officialStatus: 'Expected', country: '', latitude: null, longitude: null, speed: null, altitude: null, onGround: true };
    const first = { ...cancelled, id: 'real-otp-fra', destination: 'FRA', scheduledDeparture: '2026-11-01T04:00:00Z', scheduledArrival: '2026-11-01T06:00:00Z' };
    const routes = recommendScheduledItineraries(cancelled, [first, ...simulatedEuropeanSchedules('WAW', now)], new Set(['cancelled']), now);
    expect(routes[0]?.legs[0]?.id).toBe('real-otp-fra');
    expect(routes[0]?.legs[1]?.scheduledDeparture).toBe('2026-11-01T07:00:00.000Z');
    expect(routes[0]?.legs[1]?.scheduleSource).toBe('simulated');
    expect(recommendScheduledItineraries(cancelled, simulatedEuropeanSchedules('WAW', now), new Set(), now)).toEqual([]);
  });
});