import { describe, expect, it } from 'vitest';
import { recommendScheduledFlights, recommendScheduledItineraries } from './recommendations';
import type { LiveAircraft } from './live';
const now = Date.parse('2026-10-31T12:22:00Z');
const original: LiveAircraft = { id: 'LO644', callsign: 'LO644', origin: 'OTP', destination: 'WAW', scheduledDeparture: '2026-11-01T03:35:00Z', officialStatus: 'Expected', country: '', latitude: null, longitude: null, speed: null, altitude: null, onGround: true };
const later = { ...original, id: 'LO642', callsign: 'LO642', scheduledDeparture: '2026-11-01T06:20:00Z' };
describe('scheduled direct alternatives', () => {
  it('recommends OTP–WAW November 1 06:20 after cancellation of 03:35', () => {
    expect(recommendScheduledFlights(original, [original, later], new Set([original.id]), now)).toEqual([later]);
  });
  it('excludes earlier, different-route, departed and simulated-cancelled flights', () => {
    const candidates = [later, { ...later, id: 'earlier', scheduledDeparture: '2026-11-01T02:00:00Z' }, { ...later, id: 'other', destination: 'FRA' }, { ...later, id: 'departed', officialStatus: 'Departed' }];
    expect(recommendScheduledFlights(original, candidates, new Set([later.id]), now)).toEqual([]);
  });
  it('deduplicates and ranks later departures earliest first', () => {
    const third = { ...later, id: 'third', scheduledDeparture: '2026-11-01T08:00:00Z' };
    expect(recommendScheduledFlights(original, [third, later, later], new Set(), now).map(f => f.id)).toEqual(['LO642', 'third']);
  });
  it('uses a connecting route only when both legs exist in the supplied list', () => {
    const first = { ...later, id: 'OTP-FRA', destination: 'FRA', scheduledDeparture: '2026-11-01T04:00:00Z', scheduledArrival: '2026-11-01T06:00:00Z' };
    const second = { ...later, id: 'FRA-WAW', origin: 'FRA', scheduledDeparture: '2026-11-01T06:45:00Z' };
    expect(recommendScheduledItineraries(original, [first], new Set(), now)).toEqual([]);
    expect(recommendScheduledItineraries(original, [first, second], new Set(), now)).toEqual([{ legs: [first, second] }]);
    expect(recommendScheduledItineraries(original, [first, second], new Set([second.id]), now)).toEqual([]);
  });
  it('requires a known arrival and at least 45 minutes between listed legs', () => {
    const first = { ...later, id: 'OTP-FRA', destination: 'FRA', scheduledDeparture: '2026-11-01T04:00:00Z', scheduledArrival: '2026-11-01T06:00:00Z' };
    const second = { ...later, id: 'FRA-WAW', origin: 'FRA', scheduledDeparture: '2026-11-01T06:44:00Z' };
    expect(recommendScheduledItineraries(original, [first, second], new Set(), now)).toEqual([]);
  });
});